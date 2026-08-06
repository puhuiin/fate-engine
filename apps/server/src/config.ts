import path from 'node:path';
import { z } from 'zod';

/**
 * 环境变量强校验（zod）：启动时即失败，避免运行时出现非法端口/阈值等配置漂移。
 * 覆盖关键数值项的范围与类型，缺省值保证本地开箱即用。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  HOST: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** JWT / 响应签名唯一私密源（生产必填，缺省仅限本地开发） */
  FATE_SECRET: z.string().max(1024).optional(),
  FATE_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(31_536_000).optional(),
  FATE_ORDER_TTL_SECONDS: z.coerce.number().int().min(60).max(2_592_000).optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).optional(),
  DB_PATH: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  /** 数据生命周期治理：清理周期（分钟），0 关闭周期调度（仅启动时清理一次） */
  DATA_CLEANUP_MIN: z.coerce.number().int().min(0).max(1440).optional(),
  /** 未绑定手机号的游客账号保留天数，超期级联清理 */
  FATE_GUEST_TTL_DAYS: z.coerce.number().int().min(1).max(3650).optional(),
  /** 内核审计接口管理员令牌（未配置时写/读内核审计接口直接拒绝） */
  ADMIN_TOKEN: z.string().min(1).max(256).optional(),
  /** 单手机号每日短信发送上限，防轰炸 */
  SMS_DAILY_MAX: z.coerce.number().int().min(1).max(100).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(
    `[fate] 环境变量非法，已拒绝启动：\n${parsedEnv.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  );
  process.exit(1);
}
const env = parsedEnv.data;

// 生产环境强制私密源：缺省 FATE_SECRET 是公开的本地开发值，
// 生产若未显式配置，攻击者可据此伪造任意用户 token，启动即拒绝。
if (env.NODE_ENV === 'production' && !env.FATE_SECRET) {
  console.error('[fate] 生产环境必须设置 FATE_SECRET（随机长串），已拒绝启动');
  process.exit(1);
}
if (env.NODE_ENV === 'production' && (env.FATE_SECRET?.length ?? 0) < 32) {
  console.error('[fate] 生产环境 FATE_SECRET 长度需 ≥ 32 字符，已拒绝启动');
  process.exit(1);
}

export const config = {
  /** 运行环境：development | production */
  env: env.NODE_ENV || 'development',
  host: env.HOST || '0.0.0.0',
  port: env.PORT ?? 3001,

  /** JWT / 响应签名唯一私密源（生产必填，缺省仅限本地开发） */
  secret: env.FATE_SECRET || 'fate-dev-secret-2026',
  /** token 有效期（秒），默认 7 天 */
  tokenTtlSeconds: env.FATE_TOKEN_TTL_SECONDS ?? 7 * 24 * 3600,
  /** token 长度上限：超限直接拒绝，防超大 payload 解码放大 */
  tokenMaxLength: 1024,

  /** 深度报告解锁价格（分）：¥99 */
  unlockPriceCents: 9900,
  /** 支付渠道白名单 */
  payChannels: ['mock', 'wechat', 'alipay'],
  /** 待支付订单有效期（毫秒），默认 30 分钟，过期自动失效 */
  orderTtlMs: (env.FATE_ORDER_TTL_SECONDS ?? 30 * 60) * 1000,

  /** 请求体上限（字节） */
  bodyLimit: 64 * 1024,
  /** 全局限流：每 IP 每分钟请求数 */
  globalRateMax: env.RATE_LIMIT_MAX ?? 300,
  /** 认证/注册接口更严限流 */
  authRateMax: 20,
  rateWindowMs: 60 * 1000,

  /** 短信验证码：单码最多错误尝试次数 */
  maxCodeAttempts: 5,
  /** 验证码有效期（毫秒） */
  smsCodeTtlMs: 10 * 60 * 1000,
  /** 单手机号每日短信发送上限，防轰炸 */
  smsDailyMax: env.SMS_DAILY_MAX ?? 10,
  /** 内核审计接口管理员令牌（未配置时写/读内核审计接口直接拒绝） */
  adminToken: env.ADMIN_TOKEN,

  /** SQLite 数据库路径 */
  dbPath: env.DB_PATH || path.resolve(process.cwd(), 'data', 'fate.db'),

  /** 数据生命周期治理：清理周期（毫秒），0 表示仅启动时清理一次、不周期调度 */
  dataCleanupIntervalMs: (env.DATA_CLEANUP_MIN ?? 60) * 60 * 1000,
  /** 未绑定手机号的游客账号保留天数，超期级联清理其全部数据 */
  guestTtlDays: env.FATE_GUEST_TTL_DAYS ?? 30,
} as const;
