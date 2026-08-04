import type { Db } from '../client.js';

export interface PlanInput {
  level: number;
  title: string;
  content: string;
  execCycle: string;
}

/** 改运计划数据访问：luck_plan 表 */
export function createPlanRepo(db: Db) {
  return {
    insertBatch(recordId: number, items: PlanInput[]): void {
      const stmt = db.prepare(
        'INSERT INTO luck_plan (record_id, level, title, content, exec_cycle) VALUES (?, ?, ?, ?, ?)',
      );
      for (const it of items) {
        stmt.run(recordId, it.level, it.title, it.content, it.execCycle);
      }
    },
    listByRecord(recordId: number) {
      return db
        .prepare(`SELECT * FROM luck_plan WHERE record_id = ? ORDER BY level ASC, id ASC`)
        .all(recordId) as Record<string, unknown>[];
    },
    findWithRecordById(planId: number, userId: number) {
      return db
        .prepare(
          `SELECT p.*, r.paid_status FROM luck_plan p
           JOIN calculate_record r ON p.record_id = r.id
           WHERE p.id = ? AND r.user_id = ?`,
        )
        .get(planId, userId) as (Record<string, unknown> & { id: number; paid_status: number }) | undefined;
    },
    updateStatus(id: number, status: string): void {
      db.prepare(
        `UPDATE luck_plan SET status = ?,
           finished_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END
         WHERE id = ?`,
      ).run(status, status, id);
    },
    appendNote(id: number, note: string): void {
      db.prepare('UPDATE luck_plan SET content = content || char(10) || ? WHERE id = ?').run(note, id);
    },
    findById<T = Record<string, unknown>>(id: number) {
      return db.prepare('SELECT * FROM luck_plan WHERE id = ?').get(id) as T | undefined;
    },
  };
}

export type PlanRepo = ReturnType<typeof createPlanRepo>;
