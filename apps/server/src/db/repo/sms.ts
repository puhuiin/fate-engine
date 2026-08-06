import type { Db } from '../client.js';

/** 短信验证码数据访问：sms_code 表 */
export function createSmsRepo(db: Db) {
  return {
    deleteExpiredByPhone(phone: string): void {
      db.prepare("DELETE FROM sms_code WHERE phone = ? AND expires_at <= datetime('now')").run(
        phone,
      );
    },
    /** 清理：删除全部已过期验证码，返回删除条数 */
    deleteExpired(): number {
      const info = db.prepare("DELETE FROM sms_code WHERE expires_at <= datetime('now')").run();
      return Number(info.changes);
    },
    latestUnusedInWindow(phone: string): { created_at: string } | undefined {
      return db
        .prepare(
          `SELECT created_at FROM sms_code
           WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
             AND created_at > datetime('now', '-60 seconds')
           ORDER BY id DESC LIMIT 1`,
        )
        .get(phone) as { created_at: string } | undefined;
    },
    /** 重发窗口已过：作废历史未用验证码，避免同一手机号同时存在多个有效码 */
    invalidateAllUnused(phone: string): void {
      db.prepare('UPDATE sms_code SET used = 1 WHERE phone = ? AND used = 0').run(phone);
    },
    insert(phone: string, code: string, expiresAt: string, channel: string): void {
      db.prepare('INSERT INTO sms_code (phone, code, expires_at, channel) VALUES (?, ?, ?, ?)').run(
        phone,
        code,
        expiresAt,
        channel,
      );
    },
    findLatestLogin(phone: string) {
      return db
        .prepare(
          `SELECT * FROM sms_code
           WHERE phone = ? AND used = 0 AND expires_at > datetime('now') AND channel = 'login'
           ORDER BY id DESC LIMIT 1`,
        )
        .get(phone) as
        (Record<string, unknown> & { id: number; code: string; fail_count?: number }) | undefined;
    },
    incrementFailCount(id: number, tried: number): void {
      db.prepare('UPDATE sms_code SET fail_count = ? WHERE id = ?').run(tried, id);
    },
    /** 统计某手机号在指定时间点（本地时间字符串，含）之后发送的验证码条数，用于每日限额防轰炸 */
    countSentSince(phone: string, sinceIso: string): number {
      const row = db
        .prepare('SELECT COUNT(*) AS n FROM sms_code WHERE phone = ? AND created_at >= ?')
        .get(phone, sinceIso) as { n: number };
      return Number(row.n);
    },
    markUsed(id: number): void {
      db.prepare('UPDATE sms_code SET used = 1 WHERE id = ?').run(id);
    },
  };
}

export type SmsRepo = ReturnType<typeof createSmsRepo>;
