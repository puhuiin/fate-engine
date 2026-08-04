import type { FastifyInstance } from 'fastify';
import { fail, ok, parseId } from '../lib/util.js';
import { calculateSchema } from '../schema.js';
import type { Repos } from '../db/repo/index.js';
import { requireAuth } from './auth.js';
import { runL1 } from '../modules/l1/l1.js';
import type { TimePrecision, SourceReliability } from '../modules/l1/rating.js';
import { runL2 } from '../modules/l2/l2.js';
import { runL3 } from '../modules/l3/l3.js';
import { runL4 } from '../modules/l4/l4.js';
import { runL5 } from '../modules/l5/l5.js';
import { runL6 } from '../modules/l6/l6.js';
import { runL7 } from '../modules/l7/l7.js';
import { runL8, toPlanRows } from '../modules/l8/l8.js';
import { toRiskRows } from '../modules/l6/risk.js';
import { runL9 } from '../modules/l9/l9.js';
import { buildNineLayerReport, maskPaidLayers, maskRawReport, lockedLayers } from '../report.js';

interface ArchiveRow {
  id: number;
  gender: string | null;
  solar_date: string;
  solar_time: string | null;
  timezone_offset: number | null;
  longitude: number | null;
  latitude: number | null;
  city_name: string | null;
  time_precision?: string;
  source_reliability?: string;
}

export function calculateRoutes(app: FastifyInstance, repos: Repos): void {
  /** 触发测算：阶段1 仅执行 L1 时空校正，返回九层报告结构 */
  app.post('/api/v1/calculate', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = calculateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.send(fail(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { archiveId, calcType } = parsed.data;
    const archive = repos.archives.findByUserIdAndId<ArchiveRow>(archiveId, req.userId);
    if (!archive) {
      return reply.send(fail(404, '档案不存在或无权访问'));
    }

    let l1: ReturnType<typeof runL1>;
    let l2: ReturnType<typeof runL2>;
    let l3: ReturnType<typeof runL3>;
    let l4: ReturnType<typeof runL4>;
    let l5: ReturnType<typeof runL5>;
    let l6: ReturnType<typeof runL6>;
    let l7: ReturnType<typeof runL7>;
    let l8: ReturnType<typeof runL8>;
    let l9: ReturnType<typeof runL9>;
    try {
      l1 = runL1({
        solarDate: archive.solar_date,
        solarTime: archive.solar_time ?? undefined,
        timePrecision: (archive.time_precision ?? 'minute') as TimePrecision,
        sourceReliability: (archive.source_reliability ?? 'unknown') as SourceReliability,
        cityName: archive.city_name ?? undefined,
        longitude: archive.longitude ?? undefined,
        latitude: archive.latitude ?? undefined,
        timezoneOffset: archive.timezone_offset ?? 8,
      });

      l2 = runL2(l1.timeCorrection.trueSolarClockTime, archive.gender ?? 'other', l1.normalized.timeKnown);
      l3 = runL3(l2.bazi);
      l4 = runL4(l2.bazi);
      l5 = runL5(l2.bazi);
      l6 = runL6(l2.bazi, l4, l5, calcType);
      l7 = runL7(l1, l2, l4, l5);
      l8 = runL8(l4, l5, l2.bazi);
      l9 = runL9(l2.bazi, l4, l5, l7);
    } catch (e) {
      return reply.send(fail(400, e instanceof Error ? e.message : '出生信息不合法，请重新编辑档案'));
    }

    const report = buildNineLayerReport(l1, l2, l3, l4, l5, l6, l7, l8, l9);

    const tx = repos.db.transaction(() => {
      const recordId = repos.records.insert(archiveId, req.userId, calcType, JSON.stringify({ l1, l2, l3, l4, l5, l6, l7, l8, l9 }));
      repos.plans.insertBatch(recordId, toPlanRows(l8));
      repos.risks.insertBatch(recordId, toRiskRows(l5, l6));
      return recordId;
    });
    const recordId = tx();

    return reply.send(
      ok(
        {
          recordId,
          report: maskPaidLayers(report, false),
          paidStatus: 0,
          lockedLayers: lockedLayers(false),
          stage: 'phase5-payment',
        },
        '测算完成（阶段5：九层全量 + 付费解锁）',
      ),
    );
  });

  /** 读取测算记录（仅本人） */
  app.get('/api/v1/records/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const record = repos.records.findById<(Record<string, unknown> & { raw_json: string | null })>(
      id,
      req.userId,
    );
    if (!record) {
      return reply.send(fail(404, '记录不存在或无权访问'));
    }
    const raw = record.raw_json;
    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const paid = Number(record.paid_status ?? 0) === 1;
    const dataBroken = !raw || parsed === null || typeof parsed !== 'object';
    const report = dataBroken ? null : maskRawReport(parsed as Record<string, unknown>, paid);
    return ok({
      id: record.id,
      archive_id: record.archive_id,
      calc_type: record.calc_type,
      status: record.status,
      created_at: record.created_at,
      report,
      paidStatus: paid ? 1 : 0,
      dataError: dataBroken,
    });
  });

  /** 某记录的已知风险项清单（仅本人）：L5/L6 属付费层，未解锁仅返回 locked 标记 */
  app.get('/api/v1/records/:id/risks', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const record = repos.records.findMetaById(id, req.userId);
    if (!record) {
      return reply.send(fail(404, '记录不存在或无权访问'));
    }
    if (record.paid_status !== 1) {
      return reply.send(
        ok(
          { risks: [], total: 0, locked: true, lockedLayers: lockedLayers(false) },
          '风险项分析属深度付费层，完成解锁后查看',
        ),
      );
    }
    const rows = repos.risks.listByRecord(id);
    return ok({ risks: rows, total: rows.length, locked: false });
  });

  /** 测算历史列表（可选分页：page/pageSize，缺省时返回全部保持兼容） */
  app.get('/api/v1/records', { preHandler: requireAuth }, async (req, reply) => {
    const query = req.query as { page?: string; pageSize?: string };
    const clampInt = (v: unknown, fallback: number, max: number): number => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(1, Math.floor(n)));
    };
    const page = clampInt(query.page, 1, 100000);
    const pageSize = clampInt(query.pageSize, 10, 50);
    const paginate = query.page !== undefined || query.pageSize !== undefined;
    if (!paginate) {
      const rows = repos.records.listAllByUser(req.userId);
      return ok(rows);
    }
    const { rows, total } = repos.records.listByUser(req.userId, page, pageSize);
    return ok({ list: rows, total, page, pageSize });
  });

  /** 删除测算记录（仅本人）：级联清理改运方案、风险项与订单 */
  app.delete('/api/v1/records/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const record = repos.records.findMetaById(id, req.userId);
    if (!record) {
      return reply.send(fail(404, '记录不存在或无权访问'));
    }
    repos.records.deleteCascade(id);
    return reply.send(ok({ removed: true }, '记录已删除'));
  });
}
