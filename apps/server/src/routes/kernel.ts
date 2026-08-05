import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ok } from '../lib/util.js';
import { assertSchema, requireAdmin } from '../lib/http.js';
import type { Repos } from '../db/repo/index.js';
import { kernelLogSchema, kernelQuerySchema } from '../schema.js';

/**
 * L8 内核自演化：规则迭代记录入口。
 * 七级改运方案由内核规则生成，规则版本的演进/修订统一写入 kernel_log，
 * 保留可审计的迭代链，体现「外层版本冻结 + 内核预留迭代入口」。
 *
 * 管理面权限：内核审计是元级写入，任何登录用户可写会造成审计污染。
 * 因此读写均需携带 `x-admin-token`（对应 ADMIN_TOKEN 环境变量），
 * 未配置 ADMIN_TOKEN 时接口直接拒绝（403）。
 */
export function kernelRoutes(
  app: FastifyInstance,
  repos: Repos,
  opts: { adminToken?: string } = {},
): void {
  const preHandler = [
    (req: FastifyRequest, reply: FastifyReply) => requireAdmin(req, reply, opts.adminToken),
    app.authenticate,
  ];
  app.post('/api/v1/kernel/log', { preHandler }, async (req, reply) => {
    const { version, ruleName, ruleDetail, note } = assertSchema(kernelLogSchema, req.body ?? {});
    const id = repos.kernel.insert({ version, ruleName, ruleDetail, note });
    const row = repos.kernel.findById(id);
    return reply.send(ok(row, '内核规则迭代已记录'));
  });

  app.get('/api/v1/kernel/logs', { preHandler }, async (req) => {
    const parsed = kernelQuerySchema.safeParse(req.query ?? {});
    const version = parsed.success ? parsed.data.version : undefined;
    const rows = version ? repos.kernel.listByVersion(version) : repos.kernel.listAll();
    return ok(rows);
  });
}
