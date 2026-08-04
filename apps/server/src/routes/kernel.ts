import type { FastifyInstance } from 'fastify';
import { fail, ok } from '../lib/util.js';
import type { Db } from '../db/client.js';
import { requireAuth } from './auth.js';
import { kernelLogSchema, kernelQuerySchema } from '../schema.js';

/**
 * L8 内核自演化：规则迭代记录入口。
 * 七级改运方案由内核规则生成，规则版本的演进/修订统一写入 kernel_log，
 * 保留可审计的迭代链，体现「外层版本冻结 + 内核预留迭代入口」。
 */
export function kernelRoutes(app: FastifyInstance, db: Db): void {
  app.post('/api/v1/kernel/log', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = kernelLogSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { version, ruleName, ruleDetail, note } = parsed.data;
    const info = db
      .prepare(
        `INSERT INTO kernel_log (version, rule_name, rule_detail, note)
         VALUES (?, ?, ?, ?)`,
      )
      .run(version, ruleName, ruleDetail, note);
    const row = db
      .prepare('SELECT * FROM kernel_log WHERE id = ?')
      .get(Number(info.lastInsertRowid));
    return reply.send(ok(row, '内核规则迭代已记录'));
  });

  app.get('/api/v1/kernel/logs', { preHandler: requireAuth }, async (req) => {
    const parsed = kernelQuerySchema.safeParse(req.query ?? {});
    const version = parsed.success ? parsed.data.version : undefined;
    const rows = version
      ? db
          .prepare(
            'SELECT * FROM kernel_log WHERE version = ? ORDER BY id DESC LIMIT 100',
          )
          .all(version)
      : db.prepare('SELECT * FROM kernel_log ORDER BY id DESC LIMIT 100').all();
    return ok(rows);
  });
}
