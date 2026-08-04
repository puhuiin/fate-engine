import path from 'node:path';

/**
 * 集中配置：所有可调参数、密钥、常量统一在此定义，业务代码只依赖本模块。
 * 环境变量优先级最高，缺省值保证本地开箱即用；生产关键项（FATE_SECRET）由入口强校验。
 */
function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const config = {
  /** 运行环境：development | production */
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: envNumber('PORT', 3001),

  /** JWT / 响应签名唯一私密源（生产必填，缺省仅限本地开发） */
  secret: process.env.FATE_SECRET || 'fate-dev-secret-2026',
  /** token 有效期（秒），默认 7 天 */
  tokenTtlSeconds: envNumber('FATE_TOKEN_TTL_SECONDS', 7 * 24 * 3600),
  /** token 长度上限：超限直接拒绝，防超大 payload 解码放大 */
  tokenMaxLength: 1024,

  /** 深度报告解锁价格（分）：¥99 */
  unlockPriceCents: 9900,
  /** 支付渠道白名单 */
  payChannels: ['mock', 'wechat', 'alipay'],
  /** 待支付订单有效期（毫秒），默认 30 分钟，过期自动失效 */
  orderTtlMs: envNumber('FATE_ORDER_TTL_SECONDS', 30 * 60) * 1000,

  /** 请求体上限（字节） */
  bodyLimit: 64 * 1024,
  /** 全局限流：每 IP 每分钟请求数 */
  globalRateMax: envNumber('RATE_LIMIT_MAX', 300),
  /** 认证/注册接口更严限流 */
  authRateMax: 20,
  rateWindowMs: 60 * 1000,

  /** 短信验证码：单码最多错误尝试次数 */
  maxCodeAttempts: 5,
  /** 验证码有效期（毫秒） */
  smsCodeTtlMs: 10 * 60 * 1000,

  /** SQLite 数据库路径 */
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'fate.db'),
} as const;
