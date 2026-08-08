import { prepareStmt, type Db } from '../client.js';

export interface RiskInput {
  year: string | null;
  riskLevel: number;
  trigger: string;
  mitigation: string;
}

/** 风险项数据访问：risk_item 表 */
export function createRiskRepo(db: Db) {
  return {
    insertBatch(recordId: number, items: RiskInput[]): void {
      const stmt = prepareStmt(db, 
        'INSERT INTO risk_item (record_id, year, risk_level, trigger_condition, mitigation) VALUES (?, ?, ?, ?, ?)',
      );
      for (const it of items) {
        stmt.run(recordId, it.year, it.riskLevel, it.trigger, it.mitigation);
      }
    },
    listByRecord(recordId: number) {
      return db
        .prepare(
          `SELECT * FROM risk_item WHERE record_id = ?
           ORDER BY risk_level DESC, id ASC`,
        )
        .all(recordId) as Record<string, unknown>[];
    },
  };
}

export type RiskRepo = ReturnType<typeof createRiskRepo>;
