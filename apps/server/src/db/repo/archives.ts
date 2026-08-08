import { prepareStmt, type Db } from '../client.js';

export interface ArchiveInsert {
  userId: number;
  gender: string | null;
  solarDate: string;
  solarTime: string | null;
  timezoneOffset: number;
  longitude: number | null;
  latitude: number | null;
  cityName: string | null;
  timeSource: string | null;
  timePrecision: string;
  sourceReliability: string;
  note: string | null;
}

export interface ArchiveUpdate {
  fields: string[];
  values: Array<string | number | null>;
}

/** 档案数据访问：user_birth_archive 表，所有读写均带 user_id 归属过滤 */
export function createArchiveRepo(db: Db) {
  return {
    insert(d: ArchiveInsert): number {
      const info = db
        .prepare(
          `INSERT INTO user_birth_archive
           (user_id, gender, solar_date, solar_time, timezone_offset, longitude, latitude,
            city_name, time_source, time_precision, source_reliability, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          d.userId,
          d.gender,
          d.solarDate,
          d.solarTime,
          d.timezoneOffset,
          d.longitude,
          d.latitude,
          d.cityName,
          d.timeSource,
          d.timePrecision,
          d.sourceReliability,
          d.note,
        );
      return Number(info.lastInsertRowid);
    },
    findById<T = Record<string, unknown>>(id: number) {
      return prepareStmt(db, 'SELECT * FROM user_birth_archive WHERE id = ?').get(id) as T | undefined;
    },
    findByUserIdAndId<T = Record<string, unknown>>(id: number, userId: number) {
      return db
        .prepare('SELECT * FROM user_birth_archive WHERE id = ? AND user_id = ?')
        .get(id, userId) as T | undefined;
    },
    listByUserId(userId: number) {
      return db
        .prepare('SELECT * FROM user_birth_archive WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Record<string, unknown>[];
    },
    update(id: number, userId: number, u: ArchiveUpdate) {
      prepareStmt(db, 
        `UPDATE user_birth_archive SET ${u.fields.join(', ')} WHERE id = ? AND user_id = ?`,
      ).run(...u.values, id, userId);
    },
    recordIdsByArchive(archiveId: number, userId: number): number[] {
      const rows = db
        .prepare('SELECT id FROM calculate_record WHERE archive_id = ? AND user_id = ?')
        .all(archiveId, userId) as Array<{ id: number }>;
      return rows.map((r) => r.id);
    },
    /** 删除档案并级联清理其测算记录/改运方案/风险/订单（单一事务） */
    deleteCascade(archiveId: number, recordIds: number[]): void {
      const tx = db.transaction(() => {
        for (const rid of recordIds) {
          prepareStmt(db, 'DELETE FROM luck_plan WHERE record_id = ?').run(rid);
          prepareStmt(db, 'DELETE FROM risk_item WHERE record_id = ?').run(rid);
          prepareStmt(db, 'DELETE FROM order_pay WHERE record_id = ?').run(rid);
        }
        prepareStmt(db, 'DELETE FROM calculate_record WHERE archive_id = ?').run(archiveId);
        prepareStmt(db, 'DELETE FROM user_birth_archive WHERE id = ?').run(archiveId);
      });
      tx();
    },
  };
}

export type ArchiveRepo = ReturnType<typeof createArchiveRepo>;
