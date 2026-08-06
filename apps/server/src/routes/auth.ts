import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { maskPhone, ok, signToken, verifyToken } from '../lib/util.js';
import { ApiError } from '../lib/errors.js';
import { assertSchema } from '../lib/http.js';
import { createRateLimitHook } from '../lib/rateLimit.js';
import { guestSchema, phoneLoginSchema, profileUpdateSchema, sendSmsSchema } from '../schema.js';
import { type Repos } from '../db/repo/index.js';

/** 同一验证码最多允许的错误尝试次数，超过则作废并要求重新获取 */
const MAX_CODE_ATTEMPTS = config.maxCodeAttempts;

export function authRoutes(
  app: FastifyInstance,
  repos: Repos,
  authRateLimit?: ReturnType<typeof createRateLimitHook>,
): void {
  /** 游客临时测算 */
  app.post(
    '/api/v1/auth/guest',
    authRateLimit ? { onRequest: authRateLimit } : {},
    async (req, reply) => {
      const { nickname } = assertSchema(guestSchema, req.body ?? {});
      const userId = repos.users.insertGuest(nickname ?? '游客');
      const user = repos.users.findById(userId);
      return reply.send(ok({ user, token: signToken(userId, 'guest') }, '游客登录成功'));
    },
  );

  /** 发送短信验证码（开发阶段：写入 sms_code 表，未接短信服务时在响应中回显 devCode 便于联调） */
  app.post(
    '/api/v1/auth/sms/send',
    authRateLimit ? { onRequest: authRateLimit } : {},
    async (req, reply) => {
      const { phone, channel } = assertSchema(sendSmsSchema, req.body ?? {});
      repos.sms.deleteExpiredByPhone(phone);
      const recent = repos.sms.latestUnusedInWindow(phone);
      if (recent) {
        throw new ApiError(429, '验证码发送频繁，请 60 秒后再试');
      }
      // 每日限额：同一手机号 24 小时内发送条数上限，防短信轰炸
      const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
      if (repos.sms.countSentSince(phone, sinceDay) >= config.smsDailyMax) {
        throw new ApiError(429, '该手机号 24 小时内发送次数已达上限');
      }
      // 重发窗口已过：作废历史未用验证码，避免同一手机号同时存在多个有效码
      repos.sms.invalidateAllUnused(phone);

      const code = String(crypto.randomInt(100000, 1000000));
      const ttlMs = config.smsCodeTtlMs;
      const expiresAt = new Date(Date.now() + ttlMs).toISOString().replace('T', ' ').slice(0, 19);
      repos.sms.insert(phone, code, expiresAt, channel);

      const expiresInSec = Math.round(ttlMs / 1000);
      const devMode = process.env.NODE_ENV !== 'production';
      return reply.send(
        ok(
          { sent: true, ...(devMode ? { devCode: code, expiresIn: expiresInSec } : {}) },
          `验证码已发送（${expiresInSec} 秒内有效）`,
        ),
      );
    },
  );

  /** 手机号验证码登录 */
  app.post(
    '/api/v1/auth/phone',
    authRateLimit ? { onRequest: authRateLimit } : {},
    async (req, reply) => {
      const { phone, code, nickname, mergeGuestToken } = assertSchema(phoneLoginSchema, req.body);
      const pending = repos.sms.findLatestLogin(phone);
      if (!pending || pending.code !== code) {
        if (pending) {
          const tried = Number(pending.fail_count ?? 0) + 1;
          repos.sms.incrementFailCount(pending.id, tried);
          if (tried >= MAX_CODE_ATTEMPTS) {
            repos.sms.markUsed(pending.id);
          }
        }
        throw new ApiError(403, '验证码错误或已过期');
      }
      if (Number(pending.fail_count ?? 0) >= MAX_CODE_ATTEMPTS) {
        throw new ApiError(403, '尝试次数过多，请重新获取验证码');
      }
      repos.sms.markUsed(pending.id);

      let user = repos.users.findByPhone(phone);
      if (!user) {
        const userId = repos.users.insertPhoneUser(
          phone,
          maskPhone(phone),
          nickname ?? `用户${phone.slice(-4)}`,
        );
        user = repos.users.findById(userId);
      }
      if (!user) {
        throw new ApiError(500, '用户创建失败');
      }
      // 游客数据迁移：登录成功后，将游客 token 对应账号的档案/测算记录/订单转入本账号。
      // 安全约束：仅接受类型位为 guest 的 token；目标账号必须是未绑定手机号的纯游客，
      // 防止借用任意登录用户 token 批量转移他人数据；合并完成后删除游客空壳账号使旧 token 失效。
      // 事务在 users.mergeGuestInto 内保证一致性；无数据或已合并时静默返回 0。
      let mergedArchives = 0;
      let mergedRecords = 0;
      if (mergeGuestToken) {
        const guest = verifyToken(mergeGuestToken);
        if (guest && guest.type === 'guest' && guest.userId !== user.id) {
          const target = repos.users.findById<{ register_channel: string; phone: string | null }>(
            guest.userId,
            'id, register_channel, phone',
          );
          if (target && target.register_channel === 'guest' && target.phone === null) {
            const merged = repos.users.mergeGuestInto(user.id, guest.userId);
            mergedArchives = merged.archives;
            mergedRecords = merged.records;
          }
        }
      }
      return reply.send(
        ok(
          {
            user,
            token: signToken(user.id),
            merged: { archives: mergedArchives, records: mergedRecords },
          },
          mergedRecords > 0 ? '登录成功，游客数据已合并' : '登录成功',
        ),
      );
    },
  );
  /** 当前用户信息 */
  app.get('/api/v1/auth/me', { preHandler: app.authenticate }, async (req) => {
    const user = repos.users.findById(req.userId);
    return ok(user ?? null, user ? '获取成功' : '用户不存在');
  });

  /** 更新个人资料（当前支持昵称修改，字段级校验，nickname 1-30） */
  app.patch('/api/v1/auth/profile', { preHandler: app.authenticate }, async (req, reply) => {
    const { nickname } = assertSchema(
      profileUpdateSchema,
      req.body ?? {},
      '昵称长度需为 1-30 个字符',
    );
    repos.users.updateNickname(req.userId, nickname);
    const user = repos.users.findById(req.userId);
    return reply.send(ok(user, '资料已更新'));
  });
}
