import { prepareStmt, type Db } from '../client.js';

export const USER_PUBLIC_COLS =
  'id, phone_masked, nickname, register_channel, member_level, member_expire_at, created_at';

export type UserRow = Record<string, unknown> & { id: number };

/** 用户数据访问：sys_user 表全部读写集中在数据层，路由只做鉴权与编排 */
export function createUserRepo(db: Db) {
  return {
    insertGuest(nickname: string) {
      const info = db
        .prepare('INSERT INTO sys_user (nickname, register_channel) VALUES (?, ?)')
        .run(nickname, 'guest');
      return Number(info.lastInsertRowid);
    },
    findByPhone<T = UserRow>(phone: string, cols = USER_PUBLIC_COLS) {
      return prepareStmt(db, `SELECT ${cols} FROM sys_user WHERE phone = ?`).get(phone) as T | undefined;
    },
    insertPhoneUser(phone: string, phoneMasked: string, nickname: string) {
      const info = db
        .prepare(
          'INSERT INTO sys_user (phone, phone_masked, nickname, register_channel) VALUES (?, ?, ?, ?)',
        )
        .run(phone, phoneMasked, nickname, 'phone');
      return Number(info.lastInsertRowid);
    },
    findById<T = UserRow>(id: number, cols = USER_PUBLIC_COLS) {
      return prepareStmt(db, `SELECT ${cols} FROM sys_user WHERE id = ?`).get(id) as T | undefined;
    },
    updateNickname(id: number, nickname: string) {
      prepareStmt(db, 'UPDATE sys_user SET nickname = ? WHERE id = ?').run(nickname, id);
    },
    deleteById(id: number): void {
      prepareStmt(db, 'DELETE FROM sys_user WHERE id = ?').run(id);
    },
    /**
     * 游客数据合并：把 from 账号的档案/测算记录/订单划转到 to 账号，
     * 随后删除 from 空壳账号（单一事务，保证一致性）。
     * 返回划转的档案数与记录数；无数据时返回 { archives: 0, records: 0 }。
     * 调用方负责前置校验（from 必须是纯游客、to/from 非同账号）。
     */
    mergeGuestInto(toUserId: number, fromUserId: number): { archives: number; records: number } {
      const tx = db.transaction(() => {
        const arch = db
          .prepare('UPDATE user_birth_archive SET user_id = ? WHERE user_id = ?')
          .run(toUserId, fromUserId);
        const rec = db
          .prepare('UPDATE calculate_record SET user_id = ? WHERE user_id = ?')
          .run(toUserId, fromUserId);
        prepareStmt(db, 'UPDATE order_pay SET user_id = ? WHERE user_id = ?').run(toUserId, fromUserId);
        prepareStmt(db, 'DELETE FROM sys_user WHERE id = ?').run(fromUserId);
        return { archives: Number(arch.changes), records: Number(rec.changes) };
      });
      return tx();
    },
    countByPhone(phone: string): number {
      const row = prepareStmt(db, 'SELECT COUNT(*) AS n FROM sys_user WHERE phone = ?').get(phone) as {
        n: number;
      };
      return Number(row.n);
    },
  };
}

export type UserRepo = ReturnType<typeof createUserRepo>;
