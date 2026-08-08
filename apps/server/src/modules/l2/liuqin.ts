/**
 * L2 术数算力池 - 十神六亲流派（V1）
 * 以十神分布定位六亲星（官/印/财/食伤/比劫）的强弱与结构，
 * 给出家庭与人际关系的文化隐喻参考。纯表驱动确定性算法。
 */
import type { BaziResult } from './bazi.js';

export interface LiuQinItem {
  name: string;
  category: string;
  count: number;
  level: string;
  note: string;
}

export interface LiuQinData {
  relatives: LiuQinItem[];
  summary: string;
  note: string;
}

/** 十神 → 六亲星映射（以日主为坐标） */
const SHISHEN_LIUQIN: Array<{
  name: string;
  category: string;
  shishen: string[];
  note: string;
}> = [
  {
    name: '官杀（事业/权威）',
    category: '正官/七杀',
    shishen: ['正官', '七杀'],
    note: '主事业规则、目标感与边界感；女命兼作夫星参考。',
  },
  {
    name: '印星（庇护/学问）',
    category: '正印/偏印',
    shishen: ['正印', '偏印'],
    note: '主内在安全感与学习吸收，象征母亲与庇护力量。',
  },
  {
    name: '财星（资源/经营）',
    category: '正财/偏财',
    shishen: ['正财', '偏财'],
    note: '主现实资源与经营能力，象征财富与利益分配。',
  },
  {
    name: '食伤（才华/表达）',
    category: '食神/伤官',
    shishen: ['食神', '伤官'],
    note: '主才华输出与创造力，象征子女与表达欲。',
  },
  {
    name: '比劫（同伴/竞争）',
    category: '比肩/劫财',
    shishen: ['比肩', '劫财'],
    note: '主平辈关系与合作竞争，象征兄弟朋友。',
  },
];

function levelOf(count: number): string {
  if (count >= 3) return '强';
  if (count === 2) return '中';
  if (count === 1) return '弱';
  return '缺';
}

function noteOf(category: string, count: number): string {
  if (count >= 3) return `${category}在四柱中力量突出，相关面向是明显的人生主题。`;
  if (count === 2) return `${category}力量适中，相关面向在关键阶段会显现作用。`;
  if (count === 1) return `${category}力量偏弱，相关面向需要后天补足与经营。`;
  return `${category}未见明现，相关面向更多依靠行运引动或后天主动建设。`;
}

export function buildLiuQin(bazi: BaziResult): LiuQinData {
  // shishenStats 含 '日主' 占位，排除
  const counts = new Map(bazi.shishenStats.map((s) => [s.name, s.count]));
  const relatives: LiuQinItem[] = SHISHEN_LIUQIN.map((def) => {
    const count = def.shishen.reduce((acc, n) => acc + (counts.get(n) ?? 0), 0);
    return {
      name: def.name,
      category: def.category,
      count,
      level: levelOf(count),
      note: noteOf(def.category, count),
    };
  });

  const strong = relatives.filter((r) => r.level === '强');
  const missing = relatives.filter((r) => r.level === '缺');
  const summary =
    strong.length > 0
      ? `六亲结构中${strong.map((s) => s.name).join('、')}力量突出，是个人发展的重要支撑面；` +
        (missing.length > 0
          ? `${missing.map((m) => m.name).join('、')}相对内隐，可依靠后天经营补足。`
          : '各面向均有体现，结构相对均衡。')
      : missing.length === relatives.length
        ? '本命十神力量普遍偏弱，建议以行运与后天努力主动构建各面向。'
        : '六亲各面向力量相对均衡，无明显短板。';

  return {
    relatives,
    summary,
    note: '十神六亲是八字体系内六亲取象的文化参考，反映关系结构倾向，不作宿命判断。',
  };
}
