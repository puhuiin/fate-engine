import type { FastifyInstance } from 'fastify';
import { ok } from '../lib/util.js';
import { ApiError } from '../lib/errors.js';
import { assertSchema, requireIdParam } from '../lib/http.js';
import type { Repos } from '../db/repo/index.js';
import { lockedLayers } from '../report.js';
import { planPatchSchema } from '../schema.js';

export function planRoutes(app: FastifyInstance, repos: Repos): void {
  /** 某测算记录的全部改运计划（含打卡状态）。L8 属付费层，未解锁仅返回 locked 标记 */
  app.get('/api/v1/records/:id/plans', { preHandler: app.authenticate }, async (req, reply) => {
    const id = requireIdParam(req, 'id');
    const record = repos.records.findMetaById(id, req.userId);
    if (!record) {
      throw new ApiError(404, '记录不存在或无权访问');
    }
    if (record.paid_status !== 1) {
      return reply.send(
        ok(
          { plans: [], doneCount: 0, total: 0, locked: true, lockedLayers: lockedLayers(false) },
          '七级改运方案属深度付费层，完成解锁后查看',
        ),
      );
    }
    const rows = repos.plans.listByRecord(id);
    const done = rows.filter((r) => (r as { status: string }).status === 'done').length;
    return ok({ plans: rows, doneCount: done, total: rows.length, locked: false });
  });

  /** 打卡：标记完成 / 取消完成 / 更新备注（需已解锁） */
  app.patch('/api/v1/plans/:id', { preHandler: app.authenticate }, async (req) => {
    const id = requireIdParam(req, 'id');
    const { status, note } = assertSchema(planPatchSchema, req.body ?? {}, '没有可更新的字段');
    const plan = repos.plans.findWithRecordById(id, req.userId);
    if (!plan) {
      throw new ApiError(404, '计划不存在或无权访问');
    }
    if (plan.paid_status !== 1) {
      throw new ApiError(403, '请先解锁深度报告再执行改运打卡');
    }
    if (status) {
      repos.plans.updateStatus(id, status);
    }
    if (note) {
      repos.plans.appendNote(id, note);
    }
    const updated = repos.plans.findById(id);
    const msg = status ? '打卡状态已更新' : note ? '备注已更新' : '未更新任何字段';
    return ok(updated, msg);
  });
}
