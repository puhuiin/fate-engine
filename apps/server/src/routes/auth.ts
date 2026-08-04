import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { fail, maskPhone, ok, signToken, verifyToken } from '../lib/util.js';
import { createRateLimitHook } from '../lib/rateLimit.js';
import { guestSchema, phoneLoginSchema, sendSmsSchema } from '../schema.js';
import { type Repos, USER_PUBLIC_COLS } from '../db/repo/index.js';

/** 需登录接口的 preHandler */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    reply.code(401).send(fail(401, '未登录'));
    return;
  }
  const token = auth.slice(7).trim();
  if (!token) {
    reply.code(401).send(fail(401, '未登录'));
    return;
  }
  const v = verifyToken(token);
  if (!v) {
    reply.code(401).send(fail(401, '登录已过期，请重新登录'));
    return;
  }
  req.userId = v.userId;
  return undefined;
}

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
      const parsed = guestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { nickname } = parsed.data;
      const userId = repos.users.insertGuest(nickname ?? '游客');
      const user = repos.users.findById(userId);
      return reply.send(ok({ user, token: signToken(userId) }, '游客登录成功'));
    },
  );

  /** 发送短信验证码（开发阶段：写入 sms_code 表，未接短信服务时在响应中回显 devCode 便于联调） */
  app.post(
    '/api/v1/auth/sms/send',
    authRateLimit ? { onRequest: authRateLimit } : {},
    async (req, reply) => {
      const parsed = sendSmsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { phone, channel } = parsed.data;
      repos.sms.deleteExpiredByPhone(phone);
      const recent = repos.sms.latestUnusedInWindow(phone);
      if (recent) {
        return reply.send(fail(429, '验证码发送频繁，请 60 秒后再试'));
      }
      // 重发窗口已过：作废历史未用验证码，避免同一手机号同时存在多个有效码
      repos.sms.invalidateAllUnused(phone);

      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
      repos.sms.insert(phone, code, expiresAt, channel);

      const devMode = process.env.NODE_ENV !== 'production';
      return reply.send(
        ok(
          { sent: true, ...(devMode ? { devCode: code, expiresIn: 600 } : {}) },
          '验证码已发送（10 分钟内有效）',
        ),
      );
    },
  );

/** 手机号验证码登录 */
  app.post(
    '/api/v1/auth/phone',
    authRateLimit ? { onRequest: authRateLimit } : {},
    async (req, reply) => {
      const parsed = phoneLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { phone, code, nickname, mergeGuestToken } = parsed.data;
      const pending = repos.sms.findLatestLogin(phone);
      if (!pending || pending.code !== code) {
        if (pending) {
          const tried = Number(pending.fail_count ?? 0) + 1;
          repos.sms.incrementFailCount(pending.id, tried);
          if (tried >= MAX_CODE_ATTEMPTS) {
            repos.sms.markUsed(pending.id);
          }
        }
        return reply.send(fail(403, '验证码错误或已过期'));
      }
      if (Number(pending.fail_count ?? 0) >= MAX_CODE_ATTEMPTS) {
        return reply.send(fail(403, '尝试次数过多，请重新获取验证码'));
      }
      repos.sms.markUsed(pending.id);

      let user = repos.users.findByPhone(phone);
      if (!user) {
        const userId = repos.users.insertPhoneUser(phone, maskPhone(phone), nickname ?? `用户${phone.slice(-4)}`);
        user = repos.users.findById(userId);
      }
      if (!user) {
        return reply.send(fail(500, '用户创建失败'));
      }
      // 游客数据迁移：登录成功后，将游客 token 对应账号的档案/测算记录/订单转入本账号。
      // 事务保证一致性；guest 与手机号同源时跳过；无数据或已合并时静默返回 0。
      let mergedArchives = 0;
      let mergedRecords = 0;
      if (mergeGuestToken) {
        const guest = verifyToken(mergeGuestToken);
        if (guest && guest.userId !== user.id) {
          const tx = repos.db.transaction(() => {
            const arch = repos.db
              .prepare('UPDATE user_birth_archive SET user_id = ? WHERE user_id = ?')
              .run(user.id, guest.userId);
            const rec = repos.db
              .prepare('UPDATE calculate_record SET user_id = ? WHERE user_id = ?')
              .run(user.id, guest.userId);
            repos.db.prepare('UPDATE order_pay SET user_id = ? WHERE user_id = ?').run(
              user.id,
              guest.userId,
            );
            mergedArchives = Number(arch.changes);
            mergedRecords = Number(rec.changes);
          });
          tx();
        }
      }
      return reply.send(
        ok(
          { user, token: signToken(user.id), merged: { archives: mergedArchives, records: mergedRecords } },
          mergedRecords > 0 ? '登录成功，游客数据已合并' : '登录成功',
        ),
      );
    },
  );
  /** 当前用户信息 */
  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (req) => {
    const user = repos.users.findById(req.userId);
    return ok(user ?? null, user ? '获取成功' : '用户不存在');
  });

  /** 更新个人资料（当前支持昵称修改，字段级校验，nickname 1-30） */
  app.patch('/api/v1/auth/profile', { preHandler: requireAuth }, async (req, reply) => {
    const body = (req.body ?? {}) as { nickname?: string };
    const nickname = body.nickname === undefined ? undefined : String(body.nickname).trim();
    if (nickname !== undefined && (nickname.length < 1 || nickname.length > 30)) {
      return reply.send(fail(400, '昵称长度需为 1-30 个字符'));
    }
    if (nickname === undefined) {
      return reply.send(fail(400, '没有可更新的字段'));
    }
    repos.users.updateNickname(req.userId, nickname);
    const user = repos.users.findById(req.userId);
    return reply.send(ok(user, '资料已更新'));
  });
}
