import type { Db } from '../client.js';

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
    countByUser(userId: number): number {
      const row = db
        .prepare('SELECT COUNT(*) AS n FROM calculate_record WHERE user_id = ?')
        .get(userId) as { n: number };
      return Number(row.n);
    },
    listByUser(userId: number, page: number, pageSize: number) {
      const base =
        'FROM calculate_record r JOIN user_birth_archive a ON r.archive_id = a.id AND a.user_id = r.user_id' +
        ' WHERE r.user_id = ?';
      const cols = `r.id, r.archive_id, r.calc_type, r.status, r.paid_status, r.created_at,
                    a.solar_date, a.solar_time, a.city_name`;
      const rows = db
        .prepare(`SELECT ${cols} ${base} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`)
        .all(userId, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
      const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(userId) as { n: number };
      return { rows, total: Number(total.n) };
    },
    listAllByUser(userId: number) {
      const base =
        'FROM calculate_record r JOIN user_birth_archive a ON r.archive_id = a.id AND a.user_id = r.user_id' +
        ' WHERE r.user_id = ?';
      const cols = `r.id, r.archive_id, r.calc_type, r.status, r.paid_status, r.created_at,
                    a.solar_date, a.solar_time, a.city_name`;
      return db
        .prepare(`SELECT ${cols} ${base} ORDER BY r.created_at DESC`)
        .all(userId) as Record<string, unknown>[];
    },
    markPaid(recordId: number): void {
      db.prepare('UPDATE calculate_record SET paid_status = 1 WHERE id = ?').run(recordId);
    },
    /** 删除记录并级联清理改运方案/风险/订单（单一事务） */
    deleteCascade(recordId: number): void {
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM luck_plan WHERE record_id = ?').run(recordId);
        db.prepare('DELETE FROM risk_item WHERE record_id = ?').run(recordId);
        db.prepare('DELETE FROM order_pay WHERE record_id = ?').run(recordId);
        db.prepare('DELETE FROM calculate_record WHERE id = ?').run(recordId);
      });
      tx();
    },
  };
}

export type RecordRepo = ReturnType<typeof createRecordRepo>;
