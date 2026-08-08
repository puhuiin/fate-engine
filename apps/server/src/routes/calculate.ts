import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { ok } from '../lib/util.js';
import { ApiError } from '../lib/errors.js';
import { assertSchema, requireIdParam } from '../lib/http.js';
import { calculateSchema, recordsQuerySchema } from '../schema.js';
import type { Repos } from '../db/repo/index.js';
import { runL1 } from '../modules/l1/l1.js';
import type { TimePrecision, SourceReliability } from '../modules/l1/rating.js';
import { runL2 } from '../modules/l2/l2.js';
import { runL3 } from '../modules/l3/l3.js';
import { runL4 } from '../modules/l4/l4.js';
import { runL5 } from '../modules/l5/l5.js';
import { runL6, type L6Depth } from '../modules/l6/l6.js';
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

/**
 * 测算结果缓存：L1→L9 九层测算基于出生档案 + calcType 完全确定性，
 * 相同输入重复 POST 会产生相同结果。缓存命中直接复用已计算的九层对象与报告，
 * 跳过 lunar-javascript 的历法换算与多层推导，降低重复测算的 CPU 开销。
 * 缓存键由「实际输入元组」构成（而非 archive.id），因此档案被编辑后输入变化
 * 会自动触发重算，不存在陈旧缓存风险。仅缓存计算结果，每次 POST 仍照常落库新记录。
 * 容量上限防止常驻内存无限增长（超出时淘汰最旧条目）。
 */
export interface CalcInput {
  solarDate: string;
  solarTime?: string;
  timePrecision: TimePrecision;
  sourceReliability: SourceReliability;
  cityName?: string;
  longitude?: number;
  latitude?: number;
  timezoneOffset: number;
  gender: string;
}

interface CalcResult {
  l1: ReturnType<typeof runL1>;
  l2: ReturnType<typeof runL2>;
  l3: ReturnType<typeof runL3>;
  l4: ReturnType<typeof runL4>;
  l5: ReturnType<typeof runL5>;
  l6: ReturnType<typeof runL6>;
  l7: ReturnType<typeof runL7>;
  l8: ReturnType<typeof runL8>;
  l9: ReturnType<typeof runL9>;
  report: ReturnType<typeof buildNineLayerReport>;
}

export const CALC_CACHE_MAX = 1024;
export const calcCache = new Map<string, CalcResult>();

function calcCacheKey(input: CalcInput, calcType: string): string {
  return [
    input.solarDate,
    input.solarTime ?? '',
    input.timePrecision,
    input.sourceReliability,
    input.cityName ?? '',
    input.longitude ?? '',
    input.latitude ?? '',
    input.timezoneOffset,
    input.gender,
    calcType,
  ].join('|');
}

export function computeNineLayers(input: CalcInput, calcType: L6Depth, log: FastifyBaseLogger): CalcResult {
  const key = calcCacheKey(input, calcType);
  const hit = calcCache.get(key);
  if (hit) return hit;

  let result: CalcResult;
  try {
    const l1 = runL1({
      solarDate: input.solarDate,
      solarTime: input.solarTime,
      timePrecision: input.timePrecision,
      sourceReliability: input.sourceReliability,
      cityName: input.cityName,
      longitude: input.longitude,
      latitude: input.latitude,
      timezoneOffset: input.timezoneOffset,
    });
    const l2 = runL2(l1.timeCorrection.trueSolarClockTime, input.gender, l1.normalized.timeKnown);
    const l3 = runL3(l2.bazi);
    const l4 = runL4(l2.bazi);
    const l5 = runL5(l2.bazi);
    const l6 = runL6(l2.bazi, l4, l5, calcType);
    const l7 = runL7(l1, l2, l4, l5);
    const l8 = runL8(l4, l5, l2.bazi);
    const l9 = runL9(l2.bazi, l4, l5, l7);
    const report = buildNineLayerReport(l1, l2, l3, l4, l5, l6, l7, l8, l9);
    result = { l1, l2, l3, l4, l5, l6, l7, l8, l9, report };
  } catch (e) {
    // 区分「输入校验类」与「测算引擎内部异常」：
    // 出生信息类错误属用户输入问题 → 400 并给友好提示；
    // 其余异常是引擎缺陷 → 500 并记服务端日志，不把内部堆栈泄漏给客户端。
    if (e instanceof ApiError) throw e;
    const msg = e instanceof Error ? e.message : '';
    if (/非法|不合法|无法|无效|缺失|为空|不支持/.test(msg)) {
      throw new ApiError(400, '出生信息不合法，请重新编辑档案');
    }
    log.error({ err: e }, '测算引擎内部异常');
    throw new ApiError(500, '测算引擎开小差了，请稍后重试');
  }

  if (calcCache.size >= CALC_CACHE_MAX) {
    const oldest = calcCache.keys().next().value;
    if (oldest !== undefined) calcCache.delete(oldest);
  }
  calcCache.set(key, result);
  return result;
}

export function calculateRoutes(app: FastifyInstance, repos: Repos): void {
  /** 触发测算：阶段1 仅执行 L1 时空校正，返回九层报告结构 */
  app.post('/api/v1/calculate', { preHandler: app.authenticate }, async (req, reply) => {
    const { archiveId, calcType } = assertSchema(calculateSchema, req.body);
    const archive = repos.archives.findByUserIdAndId<ArchiveRow>(archiveId, req.userId);
    if (!archive) {
      throw new ApiError(404, '档案不存在或无权访问');
    }

    const input: CalcInput = {
      solarDate: archive.solar_date,
      solarTime: archive.solar_time ?? undefined,
      timePrecision: (archive.time_precision ?? 'minute') as TimePrecision,
      sourceReliability: (archive.source_reliability ?? 'unknown') as SourceReliability,
      cityName: archive.city_name ?? undefined,
      longitude: archive.longitude ?? undefined,
      latitude: archive.latitude ?? undefined,
      timezoneOffset: archive.timezone_offset ?? 8,
      gender: archive.gender ?? 'other',
    };

    const { l1, l2, l3, l4, l5, l6, l7, l8, l9, report } = computeNineLayers(input, calcType, req.log);

    const tx = repos.db.transaction(() => {
      const recordId = repos.records.insert(
        archiveId,
        req.userId,
        calcType,
        JSON.stringify({ l1, l2, l3, l4, l5, l6, l7, l8, l9 }),
      );
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
  app.get('/api/v1/records/:id', { preHandler: app.authenticate }, async (req) => {
    const id = requireIdParam(req, 'id');
    const record = repos.records.findById<Record<string, unknown> & { raw_json: string | null }>(
      id,
      req.userId,
    );
    if (!record) {
      throw new ApiError(404, '记录不存在或无权访问');
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
  app.get('/api/v1/records/:id/risks', { preHandler: app.authenticate }, async (req, reply) => {
    const id = requireIdParam(req, 'id');
    const record = repos.records.findMetaById(id, req.userId);
    if (!record) {
      throw new ApiError(404, '记录不存在或无权访问');
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

  /** 测算历史列表（可选分页 page/pageSize 与深度模式 calcType 筛选）。
   *  统一返回分页结构 { list, total, page, pageSize, calcType }，
   *  不再按参数有无切换数组/对象两种形状，客户端契约单一化。 */
  app.get('/api/v1/records', { preHandler: app.authenticate }, async (req) => {
    const { page, pageSize, calcType } = assertSchema(recordsQuerySchema, req.query ?? {});
    const currentPage = page ?? 1;
    const currentSize = pageSize ?? 10;
    const { rows, total } = repos.records.listByUser(
      req.userId,
      currentPage,
      currentSize,
      calcType,
    );
    return ok({ list: rows, total, page: currentPage, pageSize: currentSize, calcType });
  });

  /** 删除测算记录（仅本人）：级联清理改运方案、风险项与订单 */
  app.delete('/api/v1/records/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const id = requireIdParam(req, 'id');
    const record = repos.records.findMetaById(id, req.userId);
    if (!record) {
      throw new ApiError(404, '记录不存在或无权访问');
    }
    repos.records.deleteCascade(id);
    return reply.send(ok({ removed: true }, '记录已删除'));
  });
}
