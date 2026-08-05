import type { Db } from '../client.js';

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
      return db.prepare(`SELECT ${cols} FROM sys_user WHERE phone = ?`).get(phone) as T | undefined;
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
      return db.prepare(`SELECT ${cols} FROM sys_user WHERE id = ?`).get(id) as T | undefined;
    },
    updateNickname(id: number, nickname: string) {
      db.prepare('UPDATE sys_user SET nickname = ? WHERE id = ?').run(nickname, id);
    },
    deleteById(id: number): void {
      db.prepare('DELETE FROM sys_user WHERE id = ?').run(id);
    },
    countByPhone(phone: string): number {
      const row = db.prepare('SELECT COUNT(*) AS n FROM sys_user WHERE phone = ?').get(phone) as {
        n: number;
      };
      return Number(row.n);
    },
  };
}

export type UserRepo = ReturnType<typeof createUserRepo>;
