/**
 * L3 科学祛魅（V3）
 * 将术数符号翻译为科学人格语言：以五行结构为文化隐喻，
 * 结合心理学常识给出天赋、可发展项与行为逻辑解析。
 * 红线约定：不输出宿命论与恐吓话术，全部表述为可发展、可改变。
 */
import type { BaziResult } from '../l2/bazi.js';

export interface PersonalityDimension {
  dimension: string;
  score: number; // 0-100
  desc: string;
}

export interface L3Output {
  /** 祛魅声明（红线：对冲宿命论） */
  disenchantNote: string;
  personality: PersonalityDimension[];
  strengths: string[];
  /** 可发展项（不使用负面标签） */
  growth: string[];
  behaviorLogic: string;
}

const DIMENSIONS: Array<{ wuxing: string; dimension: string; desc: string }> = [
  { wuxing: '木', dimension: '开放性（探索与创新）', desc: '对新事物保持好奇，乐于尝试多元思路。' },
  { wuxing: '火', dimension: '外向性（表达与行动）', desc: '倾向主动表达、快速行动，有带动氛围的能量。' },
  { wuxing: '土', dimension: '尽责性（稳定与执行）', desc: '行事沉稳可靠，擅长长期坚持与落地执行。' },
  { wuxing: '金', dimension: '条理性（规则与精确）', desc: '重视逻辑秩序与质量标准，细节把控敏锐。' },
  { wuxing: '水', dimension: '宜人性（洞察与适应）', desc: '共情与观察力强，善于沟通协调与随机应变。' },
];

const STRENGTH_PROFILE: Record<string, string> = {
  木: '思维开放、有探索与创新精神，擅长提出新思路。',
  火: '表达与行动力强，热情有感染力，做事果断。',
  土: '踏实可靠、执行力强，能扛住长期而重复的任务。',
  金: '条理清晰、严谨细致，重视规则与交付质量。',
  水: '洞察敏锐、共情力强，善于适应变化与沟通协调。',
};

const GROWTH_PROFILE: Record<string, string> = {
  木: '可练习把灵感结构化为体系，让创意稳步落地。',
  火: '可练习主动表达与即刻行动，让想法更快发生。',
  土: '可练习建立明确节奏与复盘机制，避免路径依赖。',
  金: '可练习跳出流程灵活应对，保持弹性。',
  水: '可练习在信息过载时明确立场、果断取舍。',
};

function clampScore(n: number): number {
  return Math.max(42, Math.min(88, n));
}

export function runL3(bazi: BaziResult): L3Output {
  const wc = bazi.wuxingCount;

  const personality = DIMENSIONS.map((d) => {
    const count = wc[d.wuxing] ?? 0;
    const score = clampScore(42 + count * 12);
    return { dimension: d.dimension, score, desc: d.desc };
  });

  const strengths = Object.entries(wc)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([wx]) => STRENGTH_PROFILE[wx])
    .filter(Boolean);

  const weakest = Object.entries(wc)
    .filter(([, n]) => n <= 1)
    .sort((a, b) => a[1] - b[1])
    .map(([wx]) => GROWTH_PROFILE[wx])
    .filter(Boolean);

  const behaviorLogic =
    `日主 ${bazi.dayMaster.gan}（五行属${bazi.dayMaster.wuxing}）为坐标：四柱五行${bazi.strength}，` +
    `五行分布以「${Object.entries(wc).sort((a, b) => b[1] - a[1])[0][0]}」为重心，` +
    `十神结构以「${bazi.shishenStats[0]?.name ?? '-'}」为显著特征。` +
    '以上可作为理解个人行为偏好的一种文化化框架，实际行为仍主要由成长环境与主动选择塑造。';

  return {
    disenchantNote:
      '科学祛魅说明：本层将术数符号解读为「文化隐喻」，映射关系参考心理学人格常识，属于启发式参考而非科学结论，亦非对未来的预测。五行与十神是描述偏好的语言，决定命运走向的始终是人在每个选择点上的自主行动。',
    personality,
    strengths,
    growth: weakest.length ? weakest : ['五行结构均衡，可全面发展，建议结合兴趣主动深耕。'],
    behaviorLogic,
  };
}
