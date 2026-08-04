import type { Db } from '../client.js';

/** 订单数据访问：order_pay 表 */
export function createOrderRepo(db: Db) {
  /** SQLite datetime('now') 的 UTC 文本 'YYYY-MM-DD HH:MM:SS'，固定宽度可按字典序比较 */
  const utcNowString = (offsetMs: number): string =>
    new Date(Date.now() - offsetMs).toISOString().replace('T', ' ').slice(0, 19);

  return {
    /** 将超时未支付的订单置为 expired（防僵尸订单堆积） */
    expirePendingByRecord(recordId: number, userId: number, ttlMs: number): void {
      db.prepare(
        `UPDATE order_pay SET entitlement_status = 'expired'
         WHERE record_id = ? AND user_id = ? AND entitlement_status = 'pending'
           AND created_at <= ?`,
      ).run(recordId, userId, utcNowString(ttlMs));
    },
    latestPendingByRecord(recordId: number, userId: number) {
      return db
        .prepare(
          `SELECT * FROM order_pay
           WHERE record_id = ? AND user_id = ? AND entitlement_status = 'pending'
           ORDER BY id DESC LIMIT 1`,
        )
        .get(recordId, userId) as Record<string, unknown> | undefined;
    },
    insert(recordId: number, userId: number, amountCents: number, orderNo: string): number {
      const info = db
        .prepare(
          `INSERT INTO order_pay (order_no, user_id, record_id, amount_cents, entitlement_status)
           VALUES (?, ?, ?, ?, 'pending')`,
        )
        .run(orderNo, userId, recordId, amountCents);
      return Number(info.lastInsertRowid);
    },
    findById<T = Record<string, unknown>>(id: number) {
      return db.prepare('SELECT * FROM order_pay WHERE id = ?').get(id) as T | undefined;
    },
    findByIdAndUser<T = Record<string, unknown>>(id: number, userId: number) {
      return db
        .prepare('SELECT * FROM order_pay WHERE id = ? AND user_id = ?')
        .get(id, userId) as T | undefined;
    },
    latestByRecord(recordId: number, userId: number) {
      return db
        .prepare(
          `SELECT * FROM order_pay WHERE record_id = ? AND user_id = ?
           ORDER BY id DESC LIMIT 1`,
        )
        .get(recordId, userId) as Record<string, unknown> | undefined;
    },
    /** 当前用户全部订单（含关联测算记录摘要），倒序 */
    listByUser(userId: number, limit = 50) {
      return db
        .prepare(
          `SELECT o.*, r.calc_type, r.paid_status AS record_paid_status
           FROM order_pay o
           LEFT JOIN calculate_record r ON o.record_id = r.id
           WHERE o.user_id = ?
           ORDER BY o.id DESC
           LIMIT ?`,
        )
        .all(userId, limit) as Record<string, unknown>[];
    },
    markGranted(id: number, channel: string): void {
      db.prepare(
        `UPDATE order_pay SET entitlement_status = 'granted', pay_channel = ? WHERE id = ?`,
      ).run(channel, id);
    },
    markGrantedById(id: number): void {
      db.prepare(
        `UPDATE order_pay SET entitlement_status = 'granted' WHERE id = ? AND entitlement_status = 'pending'`,
      ).run(id);
    },
    markExpired(id: number): void {
      db.prepare(
        `UPDATE order_pay SET entitlement_status = 'expired'
         WHERE id = ? AND entitlement_status = 'pending'`,
      ).run(id);
    },
    isExpired(createdAt: string, ttlMs: number): boolean {
      return createdAt <= utcNowString(ttlMs);
    },
  };
}

export type OrderRepo = ReturnType<typeof createOrderRepo>;
