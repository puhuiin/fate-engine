/**
 * L2 术数算力池 - 病药论流派（V1，神峰通考）
 * 以五行失衡为「病」（太过/不及），以制化补益之五行与用神为「药」，
 * 与旺衰喜忌相互印证。纯表驱动确定性算法；祛魅口径。
 */
import type { BaziResult } from './bazi.js';

export interface BingItem {
  wx: string;
  count: number;
  type: '太过' | '偏旺' | '不及' | '偏弱';
  desc: string;
}

export interface YaoItem {
  wx: string;
  role: '克' | '泄' | '生' | '扶';
  desc: string;
}

export interface BingYaoData {
  bings: BingItem[];
  yaos: YaoItem[];
  summary: string;
  note: string;
}

const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生（泄）
const KE_BY: Record<string, string> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' }; // 克X者
const SHENGME: Record<string, string> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' }; // 生我（生）

export function buildBingYao(bazi: BaziResult): BingYaoData {
  const wc = bazi.wuxingCount;
  const sorted = Object.entries(wc).sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0] as [string, number];
  const weakest = sorted[sorted.length - 1] as [string, number];
  const missing = Object.keys(wc).filter((k) => wc[k] === 0);

  const bings: BingItem[] = [];
  const yaos: YaoItem[] = [];
  const pushYao = (wx: string, role: '克' | '泄' | '生' | '扶') => {
    if (!yaos.some((y) => y.wx === wx && y.role === role)) {
      yaos.push({ wx, role, desc: '' });
    }
  };

  // 病一：太过/偏旺
  if (strongest[1] >= 4) {
    bings.push({
      wx: strongest[0],
      count: strongest[1],
      type: '太过',
      desc: `${strongest[0]}达 ${strongest[1]} 处，气势过旺、壅滞失衡为病。`,
    });
    pushYao(KE_BY[strongest[0]], '克');
    pushYao(SHENG[strongest[0]], '泄');
  } else if (strongest[1] >= 3) {
    bings.push({
      wx: strongest[0],
      count: strongest[1],
      type: '偏旺',
      desc: `${strongest[0]} ${strongest[1]} 处为全盘最高，力量偏旺、制化不足为病。`,
    });
    pushYao(KE_BY[strongest[0]], '克');
    pushYao(SHENG[strongest[0]], '泄');
  }

  // 病二：不及/偏弱（缺失优先，其次最低）
  if (missing.length > 0) {
    for (const m of missing) {
      bings.push({
        wx: m,
        count: 0,
        type: '不及',
        desc: `${m}缺失，生克链条断裂、气机不畅为病。`,
      });
      pushYao(SHENGME[m], '生');
      pushYao(m, '扶');
    }
  } else if (weakest[1] <= 1 && weakest[1] < strongest[1]) {
    bings.push({
      wx: weakest[0],
      count: weakest[1],
      type: '偏弱',
      desc: `${weakest[0]}仅 ${weakest[1]} 处，力量偏弱、支撑不足为病。`,
    });
    pushYao(SHENGME[weakest[0]], '生');
    pushYao(weakest[0], '扶');
  }

  yaos.forEach((y) => {
    const target =
      y.role === '克' || y.role === '泄'
        ? (bings.find((b) => b.type === '太过' || b.type === '偏旺')?.wx ?? '')
        : (bings.find((b) => b.type === '不及' || b.type === '偏弱')?.wx ?? '');
    y.desc =
      y.role === '克'
        ? `以${y.wx}克${target}，制约过旺之气。`
        : y.role === '泄'
          ? `以${y.wx}泄${target}，导引旺气归流。`
          : y.role === '生'
            ? `以${y.wx}生${target}，补足所缺之源。`
            : `以${y.wx}助${target}，扶其正气势。`;
  });

  const yaoDesc = yaos.map((y) => `${y.wx}（${y.role}）`).join('、');
  const summary =
    bings.length > 0
      ? `本命「病」在两处：${bings.map((b) => b.desc).join('')}「药」宜取 ${yaoDesc}，使五行复归流通。病药所向与旺衰喜忌相互印证，同指 ${yaos.map((y) => y.wx).join('、')} 为治药方向。`
      : '五行分布较为均衡，无明显「病」位，以常规扶抑与行运调理即可。';

  return {
    bings,
    yaos,
    summary,
    note: '病药论（《神峰通考》）以「寻病定药」为法：失衡处即病，制化补益即药；此为分析视角之一，不作宿命判断。',
  };
}
