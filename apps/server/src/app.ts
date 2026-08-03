import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Db } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { archiveRoutes } from './routes/archives.js';
import { calculateRoutes } from './routes/calculate.js';
import { orderRoutes } from './routes/orders.js';
import { planRoutes } from './routes/plans.js';
import { kernelRoutes } from './routes/kernel.js';
import { fail, ok } from './lib/util.js';
import { createRateLimitHook } from './lib/rateLimit.js';
import { searchCities } from './modules/l1/location.js';

export interface BuildAppOpts {
  logger?: boolean;
  /**
   * 全局速率限制（IP 维度，进程内滑动窗口）。默认开启：普通接口每 IP 300 次/分钟。
   * 传 false 关闭（回归测试用）；传对象可覆盖全局阈值（测试注入小值验证 429）。
   */
  rateLimit?: false | { max?: number; windowMs?: number };
  /**
   * CORS 允许来源白名单；传数组时严格匹配。
   * 缺省读取 CORS_ORIGIN 环境变量（逗号分隔）；均未配置时允许全部来源（开发便利）。
   */
  corsOrigins?: string[] | true;
  /**
   * 是否信任反向代理的 X-Forwarded-For（取真实客户端 IP 做限流分桶）。
   * 传 true 信任全部；传 number 信任最右 N 跳；缺省读取 TRUST_PROXY 环境变量
   * （'true'/'1' 或数字）；未配置时不信任（直连场景）。
   */
  trustProxy?: boolean | number | string[];
}

/** 请求体上限（JSON API 场景 64KB 足够，防超大 body 资源耗尽） */
const BODY_LIMIT = 64 * 1024;

/** 全局默认限流：普通接口每 IP 300 次/分钟（RATE_LIMIT_MAX 可覆盖） */
const GLOBAL_RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 300;
const RATE_WINDOW_MS = 60 * 1000;

/** 认证/注册接口更严限流：每 IP 20 次/分钟，防验证码爆破与刷注册 */
const AUTH_RATE_MAX = 20;

function parseCorsOrigins(): string[] | null {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseTrustProxy(): boolean | number | undefined {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return raw === '1' || raw === 'true';
}

export function buildApp(db: Db, opts: BuildAppOpts = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
    bodyLimit: BODY_LIMIT,
    trustProxy: opts.trustProxy ?? parseTrustProxy(),
  });

  const whitelist = opts.corsOrigins ?? parseCorsOrigins();
  app.register(cors, {
    origin:
      whitelist === null || whitelist === true
        ? true
        : (origin: string | undefined, cb) => {
            cb(null, !origin || whitelist.includes(origin));
          },
  });

  if (opts.rateLimit !== false) {
    app.addHook(
      'onRequest',
      createRateLimitHook({
        max: opts.rateLimit?.max ?? GLOBAL_RATE_MAX,
        windowMs: opts.rateLimit?.windowMs ?? RATE_WINDOW_MS,
      }),
    );
  }

  /** 未捕获异常统一收敛为 ApiResp JSON，避免暴露 HTML/堆栈给客户端 */
  app.setErrorHandler((err: unknown, _req, reply) => {
    const e = err as { statusCode?: number; message?: string };
    const status = Number(e.statusCode) || 500;
    reply.code(status).send(
      fail(status, status >= 500 ? '服务器开小差了，请稍后重试' : e.message ?? '请求处理失败'),
    );
  });

  /** 统一错误语义：业务 code≠200 时同步设置 HTTP status，避免 body 与状态码不一致 */
  app.addHook('onSend', async (_req, reply, payload) => {
    if (typeof payload === 'string') {
      try {
        const obj = JSON.parse(payload) as { code?: number };
        if (obj && typeof obj.code === 'number' && obj.code !== 200) {
          reply.code(obj.code);
        }
      } catch {
        /* 非 JSON payload（如静态/二进制）不处理 */
      }
    }
    return payload;
  });

  app.get('/api/health', async () => ({
    ok: true,
    name: 'fate-engine',
    phase: 'phase5-payment',
    layers: 'L1-L9 full',
  }));

  /** L1 城市检索（前端录入页自动补全） */
  app.get('/api/v1/locations/search', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '').trim().slice(0, 20);
    return ok(searchCities(q));
  });

  authRoutes(
    app,
    db,
    opts.rateLimit === false ? undefined : createRateLimitHook({ max: AUTH_RATE_MAX, windowMs: RATE_WINDOW_MS }),
  );
  archiveRoutes(app, db);
  calculateRoutes(app, db);
  orderRoutes(app, db);
  planRoutes(app, db);
  kernelRoutes(app, db);

  return app;
}
