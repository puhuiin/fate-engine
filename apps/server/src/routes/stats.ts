import type { FastifyInstance } from 'fastify';
import { ok } from '../lib/util.js';
import type { Db } from '../db/client.js';
import { requireAuth } from './auth.js';

interface Scalar {
  n: number;
}

/**
 * 个人测算数据看板：一次查询聚合档案/记录/解锁/改运打卡/风险等高价值指标，
 * 供前端「我的记录」页顶部展示使用概览，也是运营侧的轻量用户画像输入。
 */
export function statsRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/v1/stats/overview', { preHandler: requireAuth }, async (req) => {
    const uid = req.userId;
    const sc = (sql: string): number => Number((db.prepare(sql).get(uid) as Scalar).n);

    const archivesCount = sc('SELECT COUNT(*) AS n FROM user_birth_archive WHERE user_id = ?');
    const totalRecords = sc('SELECT COUNT(*) AS n FROM calculate_record WHERE user_id = ?');
    const paidRecords = sc(
      'SELECT COUNT(*) AS n FROM calculate_record WHERE user_id = ? AND paid_status = 1',
    );
    const totalPlans = sc(
      `SELECT COUNT(*) AS n FROM luck_plan p
       JOIN calculate_record r ON p.record_id = r.id WHERE r.user_id = ?`,
    );
    const donePlans = sc(
      `SELECT COUNT(*) AS n FROM luck_plan p
       JOIN calculate_record r ON p.record_id = r.id
       WHERE r.user_id = ? AND p.status = 'done'`,
    );
    const riskCount = sc(
      `SELECT COUNT(*) AS n FROM risk_item k
       JOIN calculate_record r ON k.record_id = r.id
       WHERE r.user_id = ? AND k.risk_level >= 4`,
    );
    const lastRecordRow = db
      .prepare(
        `SELECT created_at FROM calculate_record WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(uid) as { created_at: string } | undefined;

    return ok({
      archivesCount,
      totalRecords,
      paidRecords,
      unlockRate: totalRecords > 0 ? Math.round((paidRecords / totalRecords) * 100) : 0,
      totalPlans,
      donePlans,
      planCompletionRate: totalPlans > 0 ? Math.round((donePlans / totalPlans) * 100) : 0,
      highRiskCount: riskCount,
      lastRecordAt: lastRecordRow?.created_at ?? null,
    });
  });
}
