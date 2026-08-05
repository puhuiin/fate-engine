import type { FastifyInstance } from 'fastify';
import { ok } from '../lib/util.js';
import type { Repos } from '../db/repo/index.js';

/**
 * 个人测算数据看板：一次查询聚合档案/记录/解锁/改运打卡/风险等高价值指标，
 * 供前端「我的记录」页顶部展示使用概览，也是运营侧的轻量用户画像输入。
 * 全部指标合并为单条 SQL（7 个子查询），单次 DB 往返完成，避免多次 COUNT 轮询。
 */
export function statsRoutes(app: FastifyInstance, repos: Repos): void {
  app.get('/api/v1/stats/overview', { preHandler: app.authenticate }, async (req) => {
    const row = repos.stats.overview(req.userId);
    const totalRecords = Number(row.total_records);
    const totalPlans = Number(row.total_plans);
    const paidRecords = Number(row.paid_records);

    return ok({
      archivesCount: Number(row.archives_count),
      totalRecords,
      paidRecords,
      unlockRate: totalRecords > 0 ? Math.round((paidRecords / totalRecords) * 100) : 0,
      totalPlans,
      donePlans: Number(row.done_plans),
      planCompletionRate:
        totalPlans > 0 ? Math.round((Number(row.done_plans) / totalPlans) * 100) : 0,
      highRiskCount: Number(row.risk_count),
      lastRecordAt: row.last_record_at ?? null,
    });
  });
}
