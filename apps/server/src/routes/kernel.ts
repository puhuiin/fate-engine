import type { FastifyInstance } from 'fastify';
import { fail, ok } from '../lib/util.js';
import type { Repos } from '../db/repo/index.js';
import { kernelLogSchema, kernelQuerySchema } from '../schema.js';

/**
 * L8 内核自演化：规则迭代记录入口。
 * 七级改运方案由内核规则生成，规则版本的演进/修订统一写入 kernel_log，
 * 保留可审计的迭代链，体现「外层版本冻结 + 内核预留迭代入口」。
 */
export function kernelRoutes(app: FastifyInstance, repos: Repos): void {
  app.post('/api/v1/kernel/log', { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = kernelLogSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { version, ruleName, ruleDetail, note } = parsed.data;
    const id = repos.kernel.insert({ version, ruleName, ruleDetail, note });
    const row = repos.kernel.findById(id);
    return reply.send(ok(row, '内核规则迭代已记录'));
  });

  app.get('/api/v1/kernel/logs', { preHandler: app.authenticate }, async (req) => {
    const parsed = kernelQuerySchema.safeParse(req.query ?? {});
    const version = parsed.success ? parsed.data.version : undefined;
    const rows = version ? repos.kernel.listByVersion(version) : repos.kernel.listAll();
    return ok(rows);
  });
}
