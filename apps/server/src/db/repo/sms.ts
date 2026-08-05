import type { Db } from '../client.js';

/** 短信验证码数据访问：sms_code 表 */
export function createSmsRepo(db: Db) {
  return {
    deleteExpiredByPhone(phone: string): void {
      db.prepare("DELETE FROM sms_code WHERE phone = ? AND expires_at <= datetime('now')").run(
        phone,
      );
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
    markUsed(id: number): void {
      db.prepare('UPDATE sms_code SET used = 1 WHERE id = ?').run(id);
    },
  };
}

export type SmsRepo = ReturnType<typeof createSmsRepo>;
