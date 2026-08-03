import type { FastifyInstance } from 'fastify';
import { fail, ok, parseId } from '../lib/util.js';
import { archiveCreateSchema, archiveUpdateSchema } from '../schema.js';
import type { Db } from '../db/client.js';
import { requireAuth } from './auth.js';

type ArchiveRow = Record<string, unknown>;

/** 档案对外字段白名单：剥离 user_id 等内部字段 */
function archivePublic(row: ArchiveRow): ArchiveRow {
  const { user_id: _uid, ...rest } = row;
  return rest;
}

export function archiveRoutes(app: FastifyInstance, db: Db): void {
  /** 创建生辰档案 */
  app.post('/api/v1/archives', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = archiveCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const d = parsed.data;
    const info = db
      .prepare(
        `INSERT INTO user_birth_archive
         (user_id, gender, solar_date, solar_time, timezone_offset, longitude, latitude,
          city_name, time_source, time_precision, source_reliability, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req.userId,
        d.gender ?? null,
        d.solarDate,
        d.solarTime ?? null,
        d.timezoneOffset ?? 8,
        d.longitude ?? null,
        d.latitude ?? null,
        d.cityName ?? null,
        d.timeSource ?? null,
        d.timePrecision,
        d.sourceReliability,
        d.note ?? null,
      );
    const id = Number(info.lastInsertRowid);
    const archive = db
      .prepare('SELECT * FROM user_birth_archive WHERE id = ?')
      .get(id);
    return reply.send(ok(archivePublic(archive as ArchiveRow), '档案已创建'));
  });

  /** 我的档案列表 */
  app.get('/api/v1/archives', { preHandler: requireAuth }, async (req) => {
    const rows = db
      .prepare('SELECT * FROM user_birth_archive WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.userId) as ArchiveRow[];
    return ok(rows.map(archivePublic));
  });

  /** 档案详情（仅本人可见） */
  app.get('/api/v1/archives/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const archive = db
      .prepare('SELECT * FROM user_birth_archive WHERE id = ? AND user_id = ?')
      .get(id, req.userId);
    if (!archive) {
      return reply.send(fail(404, '档案不存在或无权访问'));
    }
    return ok(archivePublic(archive as ArchiveRow));
  });

  /** 编辑档案（仅本人） */
  app.patch('/api/v1/archives/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const parsed = archiveUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = db
      .prepare('SELECT * FROM user_birth_archive WHERE id = ? AND user_id = ?')
      .get(id, req.userId) as { id: number } | undefined;
    if (!existing) {
      return reply.send(fail(404, '档案不存在或无权访问'));
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const assign = (col: string, val: string | number | null | undefined) => {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        values.push(val);
      }
    };
    assign('gender', d.gender);
    assign('solar_date', d.solarDate);
    assign('solar_time', d.solarTime);
    assign('timezone_offset', d.timezoneOffset);
    assign('longitude', d.longitude);
    assign('latitude', d.latitude);
    assign('city_name', d.cityName);
    assign('time_source', d.timeSource);
    assign('time_precision', d.timePrecision);
    assign('source_reliability', d.sourceReliability);
    assign('note', d.note);
    if (fields.length === 0) {
      return reply.send(fail(400, '没有可更新的字段'));
    }
    db.prepare(
      `UPDATE user_birth_archive SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    ).run(...values, id, req.userId);
    const archive = db
      .prepare('SELECT * FROM user_birth_archive WHERE id = ?')
      .get(id);
    return reply.send(ok(archivePublic(archive as ArchiveRow), '档案已更新'));
  });

  /** 删除档案（仅本人）：级联清理其测算记录、改运方案与订单 */
  app.delete('/api/v1/archives/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const existing = db
      .prepare('SELECT id FROM user_birth_archive WHERE id = ? AND user_id = ?')
      .get(id, req.userId);
    if (!existing) {
      return reply.send(fail(404, '档案不存在或无权访问'));
    }
    const recordIds = (
      db
        .prepare('SELECT id FROM calculate_record WHERE archive_id = ? AND user_id = ?')
        .all(id, req.userId) as Array<{ id: number }>
    ).map((r) => r.id);
    const tx = db.transaction(() => {
      for (const rid of recordIds) {
        db.prepare('DELETE FROM luck_plan WHERE record_id = ?').run(rid);
        db.prepare('DELETE FROM risk_item WHERE record_id = ?').run(rid);
        db.prepare('DELETE FROM order_pay WHERE record_id = ?').run(rid);
      }
      db.prepare('DELETE FROM calculate_record WHERE archive_id = ?').run(id);
      db.prepare('DELETE FROM user_birth_archive WHERE id = ?').run(id);
    });
    tx();
    return reply.send(ok({ removedRecords: recordIds.length }, '档案已删除'));
  });
}
