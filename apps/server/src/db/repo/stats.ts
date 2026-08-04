import type { Db } from '../client.js';

/** 个人统计看板数据访问：单条 SQL 聚合全部指标（单次 DB 往返） */
export function createStatsRepo(db: Db) {
  return {
    overview(uid: number) {
      return db
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
    },
  };
}

export type StatsRepo = ReturnType<typeof createStatsRepo>;
