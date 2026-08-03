import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { fail, maskPhone, ok, signToken, verifyToken } from '../lib/util.js';
import { createRateLimitHook } from '../lib/rateLimit.js';
import { guestSchema, phoneLoginSchema, sendSmsSchema } from '../schema.js';
import type { Db } from '../db/client.js';

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
const MAX_CODE_ATTEMPTS = 5;

/** 用户对外字段白名单：剥离 phone（明文）等内部字段 */
const USER_PUBLIC_COLS =
  'id, phone_masked, nickname, register_channel, member_level, member_expire_at, created_at';

export function authRoutes(
  app: FastifyInstance,
  db: Db,
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
      const info = db
        .prepare('INSERT INTO sys_user (nickname, register_channel) VALUES (?, ?)')
        .run(nickname ?? '游客', 'guest');
      const userId = Number(info.lastInsertRowid);
      const user = db
        .prepare(
          'SELECT id, phone_masked, nickname, register_channel, member_level, created_at FROM sys_user WHERE id = ?',
        )
        .get(userId);
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
      db.prepare("DELETE FROM sms_code WHERE phone = ? AND expires_at <= datetime('now')").run(phone);
      const recent = db
        .prepare(
          `SELECT created_at FROM sms_code
         WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
         ORDER BY id DESC LIMIT 1`,
        )
        .get(phone) as { created_at: string } | undefined;
      if (recent) {
        return reply.send(fail(429, '验证码已发送，请勿频繁请求'));
      }

      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
      db.prepare('INSERT INTO sms_code (phone, code, expires_at, channel) VALUES (?, ?, ?, ?)').run(
        phone,
        code,
        expiresAt,
        channel,
      );

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
    const { phone, code, nickname } = parsed.data;
    const pending = db
      .prepare(
        `SELECT * FROM sms_code
         WHERE phone = ? AND used = 0 AND expires_at > datetime('now') AND channel = 'login'
         ORDER BY id DESC LIMIT 1`,
      )
      .get(phone) as
      | (Record<string, unknown> & { id: number; code: string; fail_count?: number })
      | undefined;
    if (!pending || pending.code !== code) {
      if (pending) {
        const tried = Number(pending.fail_count ?? 0) + 1;
        db.prepare('UPDATE sms_code SET fail_count = ? WHERE id = ?').run(tried, pending.id);
        if (tried >= MAX_CODE_ATTEMPTS) {
          db.prepare('UPDATE sms_code SET used = 1 WHERE id = ?').run(pending.id);
        }
      }
      return reply.send(fail(403, '验证码错误或已过期'));
    }
    if (Number(pending.fail_count ?? 0) >= MAX_CODE_ATTEMPTS) {
      return reply.send(fail(403, '尝试次数过多，请重新获取验证码'));
    }
    db.prepare('UPDATE sms_code SET used = 1 WHERE id = ?').run(pending.id);

    let user = db
      .prepare(`SELECT ${USER_PUBLIC_COLS} FROM sys_user WHERE phone = ?`)
      .get(phone) as (Record<string, unknown> & { id: number }) | undefined;
    if (!user) {
      const info = db
        .prepare(
          'INSERT INTO sys_user (phone, phone_masked, nickname, register_channel) VALUES (?, ?, ?, ?)',
        )
        .run(phone, maskPhone(phone), nickname ?? `用户${phone.slice(-4)}`, 'phone');
      const userId = Number(info.lastInsertRowid);
      user = db.prepare(`SELECT ${USER_PUBLIC_COLS} FROM sys_user WHERE id = ?`).get(userId) as typeof user;
    }
    if (!user) {
      return reply.send(fail(500, '用户创建失败'));
    }
    return reply.send(ok({ user, token: signToken(user.id) }, '登录成功'));
    },
  );

  /** 当前用户信息 */
  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (req) => {
    const user = db
      .prepare(
        'SELECT id, phone_masked, nickname, register_channel, member_level, member_expire_at, created_at FROM sys_user WHERE id = ?',
      )
      .get(req.userId);
    return ok(user ?? null, user ? '获取成功' : '用户不存在');
  });
}
