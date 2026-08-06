import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db/client.js';
import { createRepos } from './db/repo/index.js';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { archiveRoutes } from './routes/archives.js';
import { calculateRoutes } from './routes/calculate.js';
import { orderRoutes } from './routes/orders.js';
import { planRoutes } from './routes/plans.js';
import { kernelRoutes } from './routes/kernel.js';
import { statsRoutes } from './routes/stats.js';
import { fail, ok } from './lib/util.js';
import { authenticate } from './lib/auth.js';
import { createRateLimitHook } from './lib/rateLimit.js';
import { buildOpenApiDoc } from './lib/openapi.js';
import { registerCompression } from './lib/compress.js';
import { searchCities } from './modules/l1/location.js';
import { LAYER_META } from './report.js';

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
  /**
   * 内核审计等管理接口的管理员令牌（ADMIN_TOKEN 覆盖）。
   * 未配置时管理接口一律拒绝（403）。
   */
  adminToken?: string;
}

/** 请求体上限（JSON API 场景 64KB 足够，防超大 body 资源耗尽） */
const BODY_LIMIT = config.bodyLimit;

/** 全局默认限流：普通接口每 IP 300 次/分钟（RATE_LIMIT_MAX 可覆盖） */
const GLOBAL_RATE_MAX = config.globalRateMax;
const RATE_WINDOW_MS = config.rateWindowMs;

/** 认证/注册接口更严限流：每 IP 20 次/分钟，防验证码爆破与刷注册 */
const AUTH_RATE_MAX = config.authRateMax;

function parseCorsOrigins(): string[] | null {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return null;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTrustProxy(): boolean | number | undefined {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return raw === '1' || raw === 'true';
}

interface WebDist {
  /** 前端构建产物根目录（不存在则仅提供 API 服务） */
  root: string | null;
  /** index.html 内存常驻副本：SPA 路由回退时直接返回，避免每次导航同步读盘 */
  indexHtml: Buffer | null;
}

/**
 * 生产静态托管目录：优先 WEB_DIST_DIR 环境变量，否则回退到前端构建产物
 * （apps/web/dist，Docker 镜像内已合并）。同时一次性读入 index.html 常驻内存，
 * 供 SPA 兜底回退复用，消除每次前端路由导航的 fs.existsSync + readFileSync 读盘开销。
 */
function resolveWebDist(): WebDist {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.WEB_DIST_DIR, // 显式指定优先
    path.resolve(here, '../../web/dist'),
    path.resolve(here, '../../../web/dist'),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const root = path.resolve(c);
    const idx = path.join(root, 'index.html');
    if (fs.existsSync(idx)) {
      try {
        return { root, indexHtml: fs.readFileSync(idx) };
      } catch {
        /* 读取失败继续尝试下一个候选 */
      }
    }
  }
  return { root: null, indexHtml: null };
}

export function buildApp(db: Db, opts: BuildAppOpts = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
    bodyLimit: BODY_LIMIT,
    trustProxy: opts.trustProxy ?? parseTrustProxy(),
    /** 请求追踪：X-Request-Id 贯穿全链路（响应自动回显同头，日志随 requestId 关联） */
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
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

  /** 全局挂载鉴权 preHandler（路由以 { preHandler: app.authenticate } 声明） */
  app.decorate('authenticate', authenticate);

  /** 请求计时：onResponse 输出耗时与慢请求告警，供性能回归与生产定位 */
  const SLOW_MS =
    Number(process.env.SLOW_REQUEST_MS) > 0 ? Number(process.env.SLOW_REQUEST_MS) : 800;
  app.addHook('onResponse', async (req, reply) => {
    const ms = reply.elapsedTime ?? 0;
    const base = {
      path: req.url,
      method: req.method,
      statusCode: reply.statusCode,
      ms: Math.round(ms),
      userId: (req as { userId?: number }).userId ?? undefined,
    };
    if (ms > SLOW_MS) {
      req.log.warn({ ...base }, '慢请求');
    } else if (req.url.startsWith('/api')) {
      req.log.info({ ...base }, '请求完成');
    }
  });

  /** 基础安全响应头：防 MIME 嗅探 / 点击劫持 / 页面内联泄露来源 */
  app.addHook('onRequest', async (req, reply) => {
    reply.headers({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'X-XSS-Protection': '1; mode=block',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      /** 回显请求追踪 ID（客户端可传 X-Request-Id 覆盖），便于前后端联调定位 */
      'X-Request-Id': req.id,
    });
    // API 响应含鉴权/报告/手机号/订单等敏感数据，一律禁止缓存；
    // 静态资源与 SPA 入口的缓存策略由 @fastify/static 的 setHeaders 与 notFoundHandler 分级设置，
    // 使内容哈希资源可长缓存、入口文件可即时更新。
    if (req.url.split('?')[0].startsWith('/api')) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  /** 响应压缩（仅 gzip，体积达标才压缩） */
  registerCompression(app);

  /** 未捕获异常统一收敛为 ApiResp JSON，避免暴露 HTML/堆栈给客户端；服务端保留完整错误日志 */
  app.setErrorHandler((err: unknown, req, reply) => {
    const e = err as { statusCode?: number; message?: string; stack?: string };
    const status = Number(e.statusCode) || 500;
    if (status >= 500) {
      req.log.error({ err, path: req.url }, '未捕获异常');
    } else {
      req.log.warn({ err, path: req.url }, '请求被拒绝');
    }
    reply
      .code(status)
      .send(
        fail(status, status >= 500 ? '服务器开小差了，请稍后重试' : (e.message ?? '请求处理失败')),
      );
  });

  /** 未知 API 路由统一返回 ApiResp 结构（而非 Fastify 默认纯文本 404）；非 API 路径回退到前端 SPA index.html */
  const { root: webDist, indexHtml } = resolveWebDist();
  if (webDist) {
    app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      wildcard: false,
      // 启用条件请求（ETag / Last-Modified），命中时返回 304 节省带宽
      etag: true,
      lastModified: true,
      setHeaders: (reply) => {
        // Vite 内容哈希资源（/assets/*）文件名含哈希，可永久不可变缓存；
        // index.html 等入口文件需每次重验证，保证发版后立即生效。
        const url = reply.request.url.split('?')[0];
        if (url.startsWith('/assets/')) {
          reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          reply.header('Cache-Control', 'no-cache');
        }
      },
    });
    app.log.info({ dir: webDist }, '已托管前端静态资源');
  } else {
    app.log.warn('未找到前端构建产物，仅提供 API 服务');
  }
  app.setNotFoundHandler(async (req, reply) => {
    const pathname = req.url.split('?')[0];
    if (pathname.startsWith('/api')) {
      return reply.code(404).send(fail(404, `接口不存在：${pathname}`));
    }
    // SPA 兜底：未知前端路由统一回退 index.html（内存常驻，避免每次导航读盘）
    if (indexHtml) {
      reply.header('Cache-Control', 'no-cache');
      return reply.type('text/html').send(indexHtml);
    }
    return reply.code(404).send({ code: 404, msg: 'Not Found', data: null });
  });

  /** 统一错误语义：业务 code≠200 时同步设置 HTTP status，避免 body 与状态码不一致 */
  app.addHook('onSend', async (_req, reply, payload) => {
    // 状态码已非 2xx 的响应无需同步，直接透传，避免对错误/静态 payload 做无谓解析
    if (typeof payload === 'string' && reply.statusCode >= 200 && reply.statusCode < 300) {
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

  app.get('/api/health', async (_req, reply) => {
    let dbOk = true;
    let dbSizeBytes = 0;
    try {
      db.prepare('SELECT 1 AS ok').get();
      const sizeRow = db
        .prepare(
          'SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()',
        )
        .get() as { bytes?: number };
      dbSizeBytes = Number(sizeRow?.bytes) || 0;
    } catch {
      dbOk = false;
    }
    const mem = process.memoryUsage();
    const body = {
      ok: dbOk,
      name: 'fate-engine',
      version: '0.1.0',
      env: config.env,
      uptimeSeconds: Math.round(process.uptime()),
      layers: LAYER_META.map((l) => ({ layer: l.layer, version: l.version })),
      pid: process.pid,
      memoryMB: Math.round(mem.rss / 1024 / 1024),
      dbSizeMB: Math.round(dbSizeBytes / 1024 / 1024),
      time: new Date().toISOString(),
    };
    if (!dbOk) {
      reply.code(503);
    }
    return body;
  });

  /** OpenAPI 契约：机器可读 API 文档，端点与 routes/ 同步登记 */
  app.get('/api/openapi.json', async () => buildOpenApiDoc());

  /** L1 城市检索（前端录入页自动补全） */
  app.get('/api/v1/locations/search', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '')
      .trim()
      .slice(0, 20);
    return ok(searchCities(q));
  });

  const repos = createRepos(db);

  authRoutes(
    app,
    repos,
    opts.rateLimit === false
      ? undefined
      : createRateLimitHook({ max: AUTH_RATE_MAX, windowMs: RATE_WINDOW_MS }),
  );
  archiveRoutes(app, repos);
  calculateRoutes(app, repos);
  orderRoutes(app, repos);
  planRoutes(app, repos);
  kernelRoutes(app, repos, { adminToken: opts.adminToken ?? config.adminToken });
  statsRoutes(app, repos);

  return app;
}
