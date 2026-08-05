import type { L1Output } from './modules/l1/l1.js';
import type { L2Output } from './modules/l2/l2.js';
import type { L3Output } from './modules/l3/l3.js';
import type { L4Output } from './modules/l4/l4.js';
import type { L5Output } from './modules/l5/l5.js';
import type { L6Output } from './modules/l6/l6.js';
import type { L7Output } from './modules/l7/l7.js';
import type { L8Output } from './modules/l8/l8.js';
import type { L9Output } from './modules/l9/l9.js';

/**
 * 九层固定前端输出模板（PRD「3. 九层固定前端输出模板」）。
 * 第四阶段：L1-L9 全部上线，九层结构完整交付。
 */
export const LAYER_META = [
  { layer: 1, name: '时空校正说明 & 本次测算误差公示', version: 'V2' },
  { layer: 2, name: '各术数流派原始测算结果汇总表', version: 'V1' },
  { layer: 3, name: '科学人格、天赋短板、行为逻辑解析', version: 'V3' },
  { layer: 4, name: '六维世俗落地：事业/财运/婚恋/人际/健康/重大抉择', version: 'V3+V14' },
  { layer: 5, name: '因果执念溯源、内在卡点根源分析', version: 'V4' },
  { layer: 6, name: '四条平行命运线对比 + 关键分叉点提醒', version: 'V5' },
  { layer: 7, name: '多体系冲突统一综合结论', version: 'V15' },
  { layer: 8, name: '七级分级可落地改运执行方案', version: 'V13' },
  { layer: 9, name: '人生课题与终极心性通透总结', version: 'V8+V10' },
] as const;

export type LayerData =
  L1Output | L2Output | L3Output | L4Output | L5Output | L6Output | L7Output | L8Output | L9Output;

export interface NineLayerReportItem {
  layer: number;
  name: string;
  version: string;
  status: 'ready' | 'pending' | 'locked';
  paid: boolean;
  data: LayerData | null;
  note: string | null;
}

/** 免费解锁边界：L4 六维世俗落地为第一道付费层 */
export const PAID_START_LAYER = 4;

/**
 * 付费门槛遮罩：未付费用户 L4-L9 置为 locked（data 置空）。
 * 产品语义：基础层免费浏览，深度层付费解锁。
 */
export function maskPaidLayers(
  report: NineLayerReportItem[],
  paid: boolean,
): NineLayerReportItem[] {
  if (paid) return report;
  return report.map((item) => {
    if (item.layer < PAID_START_LAYER) return item;
    return {
      ...item,
      status: 'locked',
      paid: true,
      data: null,
      note: '深度测算层：完成支付后解锁。',
    };
  });
}

/** 对象形态（raw_json 反序列化）的付费遮罩：未付费 L4-L9 置 null */
export function maskRawReport(
  raw: Record<string, unknown>,
  paid: boolean,
): Record<string, unknown> {
  if (paid) return raw;
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const layer = Number(k.replace(/^l(\d+)$/, '$1'));
    if (Number.isNaN(layer) || layer < PAID_START_LAYER) masked[k] = v;
    else masked[k] = null;
  }
  return masked;
}

/** 未付费时被锁定的层号列表 */
export const lockedLayers = (paid: boolean): number[] =>
  paid ? [] : [PAID_START_LAYER, 5, 6, 7, 8, 9];

export function buildNineLayerReport(
  l1: L1Output,
  l2: L2Output,
  l3: L3Output,
  l4: L4Output,
  l5: L5Output,
  l6: L6Output,
  l7: L7Output,
  l8: L8Output,
  l9: L9Output,
): NineLayerReportItem[] {
  const readyData: Record<number, LayerData> = {
    1: l1,
    2: l2,
    3: l3,
    4: l4,
    5: l5,
    6: l6,
    7: l7,
    8: l8,
    9: l9,
  };
  return LAYER_META.map((meta) => ({
    layer: meta.layer,
    name: meta.name,
    version: meta.version,
    status: meta.layer in readyData ? 'ready' : 'pending',
    paid: meta.layer >= PAID_START_LAYER,
    data: readyData[meta.layer] ?? null,
    note: meta.layer in readyData ? null : '该层尚未上线。',
  }));
}
