import { prepareStmt, type Db } from '../client.js';

/** 测算记录数据访问：calculate_record 表 */
export function createRecordRepo(db: Db) {
  return {
    insert(archiveId: number, userId: number, calcType: string, rawJson: string): number {
      const info = db
        .prepare(
          'INSERT INTO calculate_record (archive_id, user_id, calc_type, raw_json, status) VALUES (?, ?, ?, ?, ?)',
        )
        .run(archiveId, userId, calcType, rawJson, 'completed');
      return Number(info.lastInsertRowid);
    },
    findById<T = Record<string, unknown>>(id: number, userId: number) {
      return db
        .prepare('SELECT * FROM calculate_record WHERE id = ? AND user_id = ?')
        .get(id, userId) as T | undefined;
    },
    findMetaById(id: number, userId: number) {
      return db
        .prepare('SELECT id, paid_status FROM calculate_record WHERE id = ? AND user_id = ?')
        .get(id, userId) as { id: number; paid_status: number } | undefined;
    },
    /** 读取记录的解锁状态（不要求属主校验，调用方负责鉴权；用于支付收尾判断） */
    getPaidStatus(recordId: number): number {
      const row = db
        .prepare('SELECT paid_status FROM calculate_record WHERE id = ?')
        .get(recordId) as { paid_status: number } | undefined;
      return Number(row?.paid_status ?? 0);
    },
    countByUser(userId: number): number {
      const row = db
        .prepare('SELECT COUNT(*) AS n FROM calculate_record WHERE user_id = ?')
        .get(userId) as { n: number };
      return Number(row.n);
    },
    listByUser(userId: number, page: number, pageSize: number, calcType?: string) {
      const where = `WHERE r.user_id = ?${calcType ? ' AND r.calc_type = ?' : ''}`;
      const base =
        'FROM calculate_record r JOIN user_birth_archive a ON r.archive_id = a.id AND a.user_id = r.user_id' +
        ` ${where}`;
      const cols = `r.id, r.archive_id, r.calc_type, r.status, r.paid_status, r.created_at,
                    a.solar_date, a.solar_time, a.city_name`;
      const params = calcType ? [userId, calcType] : [userId];
      const rows = db
        .prepare(`SELECT ${cols} ${base} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
      const total = prepareStmt(db, `SELECT COUNT(*) AS n ${base}`).get(...params) as { n: number };
      return { rows, total: Number(total.n) };
    },
    markPaid(recordId: number): void {
      prepareStmt(db, 'UPDATE calculate_record SET paid_status = 1 WHERE id = ?').run(recordId);
    },
    /** 删除记录并级联清理改运方案/风险/订单（单一事务） */
    deleteCascade(recordId: number): void {
      const tx = db.transaction(() => {
        prepareStmt(db, 'DELETE FROM luck_plan WHERE record_id = ?').run(recordId);
        prepareStmt(db, 'DELETE FROM risk_item WHERE record_id = ?').run(recordId);
        prepareStmt(db, 'DELETE FROM order_pay WHERE record_id = ?').run(recordId);
        prepareStmt(db, 'DELETE FROM calculate_record WHERE id = ?').run(recordId);
      });
      tx();
    },
  };
}

export type RecordRepo = ReturnType<typeof createRecordRepo>;
