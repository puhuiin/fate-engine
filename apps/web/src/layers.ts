/** 九层报告固定前端输出模板（与服务端 LAYER_META 对齐） */

export const LAYER_NAMES = [
  '时空校正说明 & 本次测算误差公示',
  '各术数流派原始测算结果汇总表',
  '科学人格、天赋短板、行为逻辑解析',
  '六维世俗落地：事业/财运/婚恋/人际/健康/重大抉择',
  '因果执念溯源、内在卡点根源分析',
  '四条平行命运线对比 + 关键分叉点提醒',
  '多体系冲突统一综合结论',
  '七级分级可落地改运执行方案',
  '人生课题与终极心性通透总结',
] as const;

export const MODULE_HINT = [
  '',
  'L2 术数算力池',
  'L3 科学祛魅',
  'L4 权重量化',
  'L5 因果溯源',
  'L6 量子多线',
  'L7 元规则内核',
  'L8 自迭代',
  'L9 实相兜底',
] as const;

/** Loading 页演算进度用的固定九层骨架（不依赖后端返回的大对象） */
export const LAYER_SKELETON = LAYER_NAMES.map((name, i) => ({ layer: i + 1, name }));

/** 测算方式元数据：Input 页三态选择器与 Report 页 badge 共用同一描述（防口径漂移） */
export const CALC_TYPE_META = [
  { value: 'standard', label: '标准测算', desc: '九层全量报告 + 3 个关键分叉点' },
  { value: 'quantum', label: '量子展开', desc: '分叉点展开至 5 个，附各行运窗口' },
  { value: 'ultimate', label: '终极演算', desc: '全生命周期分叉点 + 完整行运窗口' },
] as const;

export type CalcType = (typeof CALC_TYPE_META)[number]['value'];

/** 按 value 取描述（Report badge 悬停提示用），未知值返回空 */
export function calcTypeDesc(value: string): string {
  return CALC_TYPE_META.find((c) => c.value === value)?.desc ?? '';
}
