import { prepareStmt, type Db } from '../client.js';

export interface KernelLogInput {
  version: string;
  ruleName: string;
  ruleDetail: string;
  note: string;
}

/** 内核规则迭代日志数据访问：kernel_log 表 */
export function createKernelRepo(db: Db) {
  return {
    insert(log: KernelLogInput): number {
      const info = db
        .prepare(
          `INSERT INTO kernel_log (version, rule_name, rule_detail, note)
           VALUES (?, ?, ?, ?)`,
        )
        .run(log.version, log.ruleName, log.ruleDetail, log.note);
      return Number(info.lastInsertRowid);
    },
    findById<T = Record<string, unknown>>(id: number) {
      return prepareStmt(db, 'SELECT * FROM kernel_log WHERE id = ?').get(id) as T | undefined;
    },
    listAll(limit = 100) {
      return prepareStmt(db, 'SELECT * FROM kernel_log ORDER BY id DESC LIMIT ?').all(limit) as Record<
        string,
        unknown
      >[];
    },
    listByVersion(version: string, limit = 100) {
      return db
        .prepare('SELECT * FROM kernel_log WHERE version = ? ORDER BY id DESC LIMIT ?')
        .all(version, limit) as Record<string, unknown>[];
    },
  };
}

export type KernelRepo = ReturnType<typeof createKernelRepo>;
