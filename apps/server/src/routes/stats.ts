import type { FastifyInstance } from 'fastify';
import { ok } from '../lib/util.js';
import type { Db } from '../db/client.js';
import { requireAuth } from './auth.js';

/**
 * 个人测算数据看板：一次查询聚合档案/记录/解锁/改运打卡/风险等高价值指标，
 * 供前端「我的记录」页顶部展示使用概览，也是运营侧的轻量用户画像输入。
 * 全部指标合并为单条 SQL（7 个子查询），单次 DB 往返完成，避免多次 COUNT 轮询。
 */
export function statsRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/v1/stats/overview', { preHandler: requireAuth }, async (req) => {
    const uid = req.userId;
    const row = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM user_birth_archive WHERE user_id = ?)                          AS archives_count,
           (SELECT COUNT(*) FROM calculate_record WHERE user_id = ?)                            AS total_records,
           (SELECT COUNT(*) FROM calculate_record WHERE user_id = ? AND paid_status = 1)        AS paid_records,
           (SELECT COUNT(*) FROM luck_plan p JOIN calculate_record r ON p.record_id = r.id
              WHERE r.user_id = ?)                                                              AS total_plans,
           (SELECT COUNT(*) FROM luck_plan p JOIN calculate_record r ON p.record_id = r.id
              WHERE r.user_id = ? AND p.status = 'done')                                        AS done_plans,
           (SELECT COUNT(*) FROM risk_item k JOIN calculate_record r ON k.record_id = r.id
              WHERE r.user_id = ? AND k.risk_level >= 4)                                        AS risk_count,
           (SELECT created_at FROM calculate_record WHERE user_id = ?
              ORDER BY created_at DESC LIMIT 1)                                                 AS last_record_at
      `,
      )
      .get(uid, uid, uid, uid, uid, uid, uid) as {
      archives_count: number;
      total_records: number;
      paid_records: number;
      total_plans: number;
      done_plans: number;
      risk_count: number;
      last_record_at: string | null;
    };

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
      planCompletionRate: totalPlans > 0 ? Math.round((Number(row.done_plans) / totalPlans) * 100) : 0,
      highRiskCount: Number(row.risk_count),
      lastRecordAt: row.last_record_at ?? null,
    });
  });
}
