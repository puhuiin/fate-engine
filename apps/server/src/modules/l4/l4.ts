/**
 * L4 权重量化（V3+V14）
 * 六维世俗落地评分：30% 先天结构 + 20% 流年行运 + 50% 人为主动。
 * 权重可在后台动态浮动（见 WEIGHTS）。
 * 红线约定：人为权重恒定过半，明确「人为主导」。
 */
import type { BaziResult } from '../l2/bazi.js';
import { runDeepAnalysis } from '../l2/deep.js';

export interface L4Dimension {
  key: string;
  name: string;
  xiantian: number; // 0-100
  liunian: number; // 0-100
  renwei: number; // 0-100
  total: number; // 加权总分
  advice: string;
}

export interface L4Output {
  weightModel: { xiantian: number; liunian: number; renwei: number; note: string };
  dimensions: L4Dimension[];
  summary: string;
  /** 深度维度：用神五行对应的六维补位提示（倾向性文化参考） */
  depthNote: string;
}

/** 权重模型：后台可动态浮动（当前固定 30/20/50） */
const WEIGHTS = { xiantian: 0.3, liunian: 0.2, renwei: 0.5 };

function clamp(n: number, lo = 30, hi = 95): number {
  return Math.round(Math.max(lo, Math.min(hi, n)));
}

const WX_IS_SAME = (a: string, b: string) => a === b;
const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** a 对 b 的关系：'same' | 'sheng(a生b)' | 'beSheng(a被b生)' | 'ke(a克b)' | 'beKe(a被b克)' */
function relation(a: string, b: string): string {
  if (WX_IS_SAME(a, b)) return 'same';
  if (SHENG[a] === b) return 'sheng';
  if (SHENG[b] === a) return 'beSheng';
  if (KE[a] === b) return 'ke';
  return 'beKe';
}

/** 五行均衡度：计数标准差越小越均衡 */
function balanceScore(wc: Record<string, number>): number {
  const vals = Object.values(wc);
  const mean = vals.reduce((s, n) => s + n, 0) / vals.length;
  const variance = vals.reduce((s, n) => s + (n - mean) ** 2, 0) / vals.length;
  return clamp(68 - variance * 8, 45, 88);
}

/** 用神五行对应的六维补位建议（倾向性文化参考） */
const WX_DEPTH_ADVICE: Record<string, string> = {
  木: '木主生长与开创，事业与财富维度可多往「成长型、创新性」方向补位；人际与健康上以「舒展、规律」为基调。',
  火: '火主热情与传播，事业与人际可多往「表达、影响、服务」方向补位；决策维度以「想清楚再行动」为节奏。',
  土: '土主承载与稳定，财富与健康可多往「积累、深耕、固定资产」方向补位；事业以「守正出奇」为基调。',
  金: '金主规则与精进，事业与决策可多往「专业、规范、打磨细节」方向补位；人际上以「坦诚直接」为基调。',
  水: '水主灵动与连接，人际与财富可多往「信息、流通、跨领域协作」方向补位；决策以「灵活留白」为基调。',
};

export function runL4(bazi: BaziResult): L4Output {
  const wc = bazi.wuxingCount;
  const dayWx = bazi.dayMaster.wuxing;
  const shishen = bazi.shishenStats;
  const deep = runDeepAnalysis(bazi);

  const countOf = (name: string) => shishen.find((s) => s.name === name)?.count ?? 0;
  const guanSha = countOf('正官') + countOf('七杀');
  const yin = countOf('正印') + countOf('偏印');
  const cai = countOf('正财') + countOf('偏财');
  const biJie = countOf('比肩') + countOf('劫财');
  const shiShang = countOf('食神') + countOf('伤官');

  // 先天分（结构映射）
  const xiantian = {
    career: clamp(55 + guanSha * 8 + yin * 5 + cai * 3),
    wealth: clamp(55 + cai * 8 + shiShang * 5),
    marriage: clamp(
      55 +
        (bazi.pillars.day.shishenZhi[0] === '正财' || bazi.pillars.day.shishenZhi[0] === '正官'
          ? 10
          : bazi.pillars.day.shishenZhi[0] === '七杀'
            ? -4
            : 0),
    ),
    social: clamp(52 + biJie * 6 + shiShang * 4),
    health: balanceScore(wc),
    decision: clamp(55 + countOf('七杀') * 10 + countOf('偏印') * 6),
  };

  // 流年分：以当前大运天干五行与日主生克定基调（大运定位年份取自 L2 当前年份）
  const daYunWx = bazi.currentDaYun?.ganzhi?.[0]
    ? ((
        {
          甲: '木',
          乙: '木',
          丙: '火',
          丁: '火',
          戊: '土',
          己: '土',
          庚: '金',
          辛: '金',
          壬: '水',
          癸: '水',
        } as Record<string, string>
      )[bazi.currentDaYun.ganzhi[0]] ?? '')
    : '';
  const rel = daYunWx ? relation(daYunWx, dayWx) : 'same';
  const flowBase =
    rel === 'same' || rel === 'sheng' ? 62 : rel === 'beSheng' ? 58 : rel === 'ke' ? 50 : 55;

  const liunian = {
    career: clamp(flowBase + (rel === 'beKe' ? -6 : rel === 'ke' ? -3 : 3)),
    wealth: clamp(flowBase + 2),
    marriage: clamp(flowBase + 1),
    social: clamp(flowBase + 2),
    health: clamp(flowBase - (rel === 'beKe' ? 4 : 1)),
    decision: clamp(flowBase),
  };

  // 人为分：反映主动空间，通常高于 50
  const renwei = {
    career: 60,
    wealth: 58,
    marriage: 62,
    social: 60,
    health: 64,
    decision: 66,
  };

  const dims: L4Dimension[] = [
    {
      key: 'career',
      name: '事业',
      xiantian: xiantian.career,
      liunian: liunian.career,
      renwei: renwei.career,
      total: clamp(
        xiantian.career * WEIGHTS.xiantian +
          liunian.career * WEIGHTS.liunian +
          renwei.career * WEIGHTS.renwei,
      ),
      advice:
        '围绕优势技能做长期积累，主动争取能放大自己强项的角色，年度内为自己设定一个可衡量的突破目标。',
    },
    {
      key: 'wealth',
      name: '财运',
      xiantian: xiantian.wealth,
      liunian: liunian.wealth,
      renwei: renwei.wealth,
      total: clamp(
        xiantian.wealth * WEIGHTS.xiantian +
          liunian.wealth * WEIGHTS.liunian +
          renwei.wealth * WEIGHTS.renwei,
      ),
      advice: '建立记账与储蓄习惯，用 6-12 个月验证一个副业或技能变现方向，控制杠杆与负债比例。',
    },
    {
      key: 'marriage',
      name: '婚恋',
      xiantian: xiantian.marriage,
      liunian: liunian.marriage,
      renwei: renwei.marriage,
      total: clamp(
        xiantian.marriage * WEIGHTS.xiantian +
          liunian.marriage * WEIGHTS.liunian +
          renwei.marriage * WEIGHTS.renwei,
      ),
      advice:
        '明确自己在关系中的核心需求并学会表达，把「沟通练习」当作日常习惯，比等待缘分更有意义。',
    },
    {
      key: 'social',
      name: '人际',
      xiantian: xiantian.social,
      liunian: liunian.social,
      renwei: renwei.social,
      total: clamp(
        xiantian.social * WEIGHTS.xiantian +
          liunian.social * WEIGHTS.liunian +
          renwei.social * WEIGHTS.renwei,
      ),
      advice: '主动维护高质量关系网络，每周为 2-3 个重要关系做一次有深度的连接。',
    },
    {
      key: 'health',
      name: '健康',
      xiantian: xiantian.health,
      liunian: liunian.health,
      renwei: renwei.health,
      total: clamp(
        xiantian.health * WEIGHTS.xiantian +
          liunian.health * WEIGHTS.liunian +
          renwei.health * WEIGHTS.renwei,
      ),
      advice: '固定作息与适量运动是成本最低的健康投资，先从每周 3 次、每次 30 分钟开始。',
    },
    {
      key: 'decision',
      name: '重大抉择',
      xiantian: xiantian.decision,
      liunian: liunian.decision,
      renwei: renwei.decision,
      total: clamp(
        xiantian.decision * WEIGHTS.xiantian +
          liunian.decision * WEIGHTS.liunian +
          renwei.decision * WEIGHTS.renwei,
      ),
      advice: '重大决策前列出利弊清单并给每个选项设定「退出条件」，避免情绪化一次性决定。',
    },
  ];

  return {
    weightModel: {
      ...WEIGHTS,
      note: '基础权重：30% 先天结构 + 20% 流年行运 + 50% 人为主动。人为权重恒定过半，后台可动态浮动以适配运营策略。',
    },
    dimensions: dims,
    summary:
      '在任何维度，人为因素（50%）都大于先天与流年之和（合计 50%）。先天只提示倾向，流年只标记节奏，真正决定结果的，是人在日常选择中的主动作为。',
    depthNote: `传统用神为「${deep.yongShen.yong}」（${deep.yongShen.method}，${deep.yongShen.tiaoHou}，文化参考）：${
      WX_DEPTH_ADVICE[deep.yongShen.yong] ?? '各维度保持平衡补位即可，无需迷信单一五行。'
    }用神只是传统体系里的一个参照系，分数与建议以「人为主导」为准。`,
  };
}
