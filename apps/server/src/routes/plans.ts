import type { FastifyInstance } from 'fastify';
import { fail, ok, parseId } from '../lib/util.js';
import type { Db } from '../db/client.js';
import { requireAuth } from './auth.js';
import { lockedLayers } from '../report.js';

interface PlanRow {
  id: number;
  record_id: number;
}

export function planRoutes(app: FastifyInstance, db: Db): void {
  /** 某测算记录的全部改运计划（含打卡状态）。L8 属付费层，未解锁仅返回 locked 标记 */
  app.get('/api/v1/records/:id/plans', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const record = db
      .prepare('SELECT id, paid_status FROM calculate_record WHERE id = ? AND user_id = ?')
      .get(id, req.userId) as { id: number; paid_status: number } | undefined;
    if (!record) {
      return reply.send(fail(404, '记录不存在或无权访问'));
    }
    if (record.paid_status !== 1) {
      return reply.send(
        ok(
          { plans: [], doneCount: 0, total: 0, locked: true, lockedLayers: lockedLayers(false) },
          '七级改运方案属深度付费层，完成解锁后查看',
        ),
      );
    }
    const rows = db
      .prepare(
        `SELECT * FROM luck_plan WHERE record_id = ?
         ORDER BY level ASC, id ASC`,
      )
      .all(id);
    const done = rows.filter((r) => (r as { status: string }).status === 'done').length;
    return ok({ plans: rows, doneCount: done, total: rows.length, locked: false });
  });

  /** 打卡：标记完成 / 取消完成 / 更新备注（需已解锁） */
  app.patch('/api/v1/plans/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const body = (req.body ?? {}) as { status?: string; note?: string };
    const plan = db
      .prepare(
        `SELECT p.*, r.paid_status FROM luck_plan p
         JOIN calculate_record r ON p.record_id = r.id
         WHERE p.id = ? AND r.user_id = ?`,
      )
      .get(id, req.userId) as (PlanRow & { paid_status: number }) | undefined;
    if (!plan) {
      return reply.send(fail(404, '计划不存在或无权访问'));
    }
    if (plan.paid_status !== 1) {
      return reply.send(fail(403, '请先解锁深度报告再执行改运打卡'));
    }

    const status = body.status === 'done' ? 'done' : body.status === 'pending' ? 'pending' : null;
    if (status) {
      db.prepare(
        `UPDATE luck_plan SET status = ?,
           finished_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END
         WHERE id = ?`,
      ).run(status, status, id);
    }
    const note = String(body.note ?? '').trim();
    if (body.note !== undefined && note.length > 200) {
      return reply.send(fail(400, '备注长度 ≤200'));
    }
    if (body.note !== undefined) {
      db.prepare('UPDATE luck_plan SET content = content || char(10) || ? WHERE id = ?').run(
        note,
        id,
      );
    }
    const updated = db.prepare('SELECT * FROM luck_plan WHERE id = ?').get(id);
    const msg = status ? '打卡状态已更新' : body.note !== undefined ? '备注已更新' : '未更新任何字段';
    return ok(updated, msg);
  });
}
