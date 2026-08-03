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
import { searchCities } from './modules/l1/location.js';

export function buildApp(db: Db, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  app.register(cors, { origin: true });

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

  authRoutes(app, db);
  archiveRoutes(app, db);
  calculateRoutes(app, db);
  orderRoutes(app, db);
  planRoutes(app, db);
  kernelRoutes(app, db);

  return app;
}
