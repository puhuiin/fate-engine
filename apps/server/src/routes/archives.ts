import type { FastifyInstance } from 'fastify';
import { fail, ok, parseId } from '../lib/util.js';
import { archiveCreateSchema, archiveUpdateSchema } from '../schema.js';
import type { Repos } from '../db/repo/index.js';

type ArchiveRow = Record<string, unknown>;

/** 档案对外字段白名单：剥离 user_id 等内部字段 */
function archivePublic(row: ArchiveRow): ArchiveRow {
  const { user_id: _uid, ...rest } = row;
  return rest;
}

export function archiveRoutes(app: FastifyInstance, repos: Repos): void {
  /** 创建生辰档案 */
  app.post('/api/v1/archives', { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = archiveCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const d = parsed.data;
    const id = repos.archives.insert({
      userId: req.userId,
      gender: d.gender ?? null,
      solarDate: d.solarDate,
      solarTime: d.solarTime ?? null,
      timezoneOffset: d.timezoneOffset ?? 8,
      longitude: d.longitude ?? null,
      latitude: d.latitude ?? null,
      cityName: d.cityName ?? null,
      timeSource: d.timeSource ?? null,
      timePrecision: d.timePrecision,
      sourceReliability: d.sourceReliability,
      note: d.note ?? null,
    });
    const archive = repos.archives.findById(id);
    return reply.send(ok(archivePublic(archive as ArchiveRow), '档案已创建'));
  });

  /** 我的档案列表 */
  app.get('/api/v1/archives', { preHandler: app.authenticate }, async (req) => {
    const rows = repos.archives.listByUserId(req.userId);
    return ok(rows.map(archivePublic));
  });

  /** 档案详情（仅本人可见） */
  app.get('/api/v1/archives/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const archive = repos.archives.findByUserIdAndId(id, req.userId);
    if (!archive) {
      return reply.send(fail(404, '档案不存在或无权访问'));
    }
    return ok(archivePublic(archive as ArchiveRow));
  });

  /** 编辑档案（仅本人） */
  app.patch('/api/v1/archives/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const parsed = archiveUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = repos.archives.findByUserIdAndId<{ id: number }>(id, req.userId);
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
    repos.archives.update(id, req.userId, { fields, values });
    const archive = repos.archives.findById(id);
    return reply.send(ok(archivePublic(archive as ArchiveRow), '档案已更新'));
  });

  /** 删除档案（仅本人）：级联清理其测算记录、改运方案与订单 */
  app.delete('/api/v1/archives/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const existing = repos.archives.findByUserIdAndId<{ id: number }>(id, req.userId);
    if (!existing) {
      return reply.send(fail(404, '档案不存在或无权访问'));
    }
    const recordIds = repos.archives.recordIdsByArchive(id, req.userId);
    repos.archives.deleteCascade(id, recordIds);
    return reply.send(ok({ removedRecords: recordIds.length }, '档案已删除'));
  });
}
