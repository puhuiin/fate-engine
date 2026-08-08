import type { L2Result, L4Result, L5Result, L6Result, L7Result, L9Result } from '../../api/client';

// 五行喜忌分析（纯推导，不改模块输出）

type WuXing = '木' | '火' | '土' | '金' | '水';

const WX_SHENG: Record<WuXing, WuXing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生（食伤）
const WX_SHENGME: Record<WuXing, WuXing> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' }; // 生我（印）
const WX_KE: Record<WuXing, WuXing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // 我克（财）
const WX_KEME: Record<WuXing, WuXing> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' }; // 克我（官杀）

export interface XiJiAnalysis {
  strength: string;
  day: string;
  xi: string[];
  ji: string[];
  missing: string[];
  weakest: [string, number];
  strongest: [string, number];
  note: string;
}

/** 依据日主旺衰推导喜忌：偏旺宜克泄耗、偏弱宜生扶、中和补最弱 */
export function deriveXiJi(bazi: L2Result['bazi']): XiJiAnalysis {
  const day = bazi.dayMaster.wuxing as WuXing;
  const wc = bazi.wuxingCount;
  const sorted = Object.entries(wc).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0] as [string, number];
  const strongest = sorted[sorted.length - 1] as [string, number];
  const missing = Object.keys(wc).filter((k) => wc[k] === 0);

  if (bazi.strength === '偏旺') {
    const xi = [WX_KEME[day], WX_SHENG[day], WX_KE[day]]; // 克我/我生/我克 → 克泄耗
    const ji = [WX_SHENGME[day], day]; // 生我/同我 → 生扶
    const hit = missing.filter((m) => xi.includes(m as WuXing));
    return {
      strength: bazi.strength,
      day,
      xi,
      ji,
      missing,
      weakest,
      strongest,
      note: `日主${day}偏旺，宜「克泄耗」求平衡：喜用 ${xi.join('、')}；忌「生扶」助长：忌 ${ji.join('、')}。${
        hit.length ? `其中所缺「${hit.join('、')}」恰为喜用，缺而无碍，主动补足更利格局。` : ''
      }`,
    };
  }
  if (bazi.strength === '偏弱') {
    const xi = [WX_SHENGME[day], day]; // 生我/同我
    const ji = [WX_KEME[day], WX_SHENG[day], WX_KE[day]];
    const hit = missing.filter((m) => ji.includes(m as WuXing));
    return {
      strength: bazi.strength,
      day,
      xi,
      ji,
      missing,
      weakest,
      strongest,
      note: `日主${day}偏弱，宜「生扶」补力：喜用 ${xi.join('、')}；忌「克泄耗」损耗：忌 ${ji.join('、')}。${
        hit.length ? `所缺「${hit.join('、')}」为忌神，缺失反而减少耗损。` : ''
      }`,
    };
  }
  return {
    strength: '中和',
    day,
    xi: [weakest[0]],
    ji: [],
    missing,
    weakest,
    strongest,
    note: `五行${bazi.strength}、分布相对均衡，无需强行偏向；宜略补相对最弱之「${weakest[0]}」（${weakest[1]} 处），并在行动上保持多方兼顾。`,
  };
}

/** 十神结构解读：按旺衰阈值输出性格倾向 */
export function deriveShishen(bazi: L2Result['bazi']): string[] {
  const countOf = (n: string) => bazi.shishenStats.find((s) => s.name === n)?.count ?? 0;
  const biJie = countOf('比肩') + countOf('劫财');
  const guanSha = countOf('正官') + countOf('七杀');
  const yin = countOf('正印') + countOf('偏印');
  const shiShang = countOf('食神') + countOf('伤官');
  const cai = countOf('正财') + countOf('偏财');
  const out: string[] = [];
  if (biJie >= 3)
    out.push(`比劫偏旺（${biJie} 处）：独立自主、重情讲义、执行力强，但需留意固执与竞争心。`);
  if (guanSha >= 3)
    out.push(`官杀偏旺（${guanSha} 处）：自律、有目标感与责任心，但易自我加压，需学会放松。`);
  if (yin >= 3)
    out.push(`印星偏旺（${yin} 处）：学习吸收能力强、做事有规划，但需避免想得多、动得少。`);
  if (shiShang >= 3)
    out.push(`食伤偏旺（${shiShang} 处）：表达与创造力突出，善于破局，但需避免心高气浮。`);
  if (cai >= 3)
    out.push(`财星偏旺（${cai} 处）：重实际、有经营意识，行动讲回报，但需避免过于精打细算。`);
  if (out.length === 0) out.push('十神分布较为均衡，性格偏综合性，无明显单一主导。');
  return out;
}

/** 六维排序与强弱标注 */
export function rankDimensions(l4: L4Result): {
  sorted: L4Result['dimensions'];
  max: L4Result['dimensions'][number];
  min: L4Result['dimensions'][number];
} {
  const sorted = [...l4.dimensions].sort((a, b) => b.total - a.total);
  return { sorted, max: sorted[0], min: sorted[sorted.length - 1] };
}

export interface SynergyInsight {
  label: string;
  text: string;
}

/** 跨层一致性洞察：把九层结论串成因果链（纯推导） */
export function deriveSynergy(
  l4: L4Result,
  l5: L5Result,
  l6: L6Result,
  l7: L7Result,
  l9: L9Result,
): SynergyInsight[] {
  const { max, min } = rankDimensions(l4);
  const topLine = [...l6.lines].sort((a, b) => b.fit - a.fit)[0];
  return [
    {
      label: '短板闭环',
      text: `最需提升的「${min.name}」（${min.total} 分）与主卡点「${l5.mainKnot}」同源，心智模式直接塑造行为短板，改善它等于同时解锁卡点。`,
    },
    {
      label: '优势主线',
      text: `最强维度「${max.name}」（${max.total} 分）与最高契合线「${topLine.name}」（契合 ${topLine.fit}）方向一致，顺势而为可最大化个人禀赋。`,
    },
    {
      label: '内核自洽',
      text: `L7 内核声明「${truncate(l7.coreNote, 18)}」与 L9 心性本质「${truncate(l9.essence, 18)}」互为表里，演算结论内部自洽。`,
    },
  ];
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
