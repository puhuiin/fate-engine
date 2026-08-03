/**
 * L9 实相兜底（V8+V10）
 * 人生课题与终极心性通透总结：把九层收束为课题、要义与正念提示。
 * 红线约定：兜底层必须包含合规声明——本报告为文化娱乐与自我观察参考，
 * 不构成预测或任何专业建议；如有持续情绪困扰应寻求专业帮助。
 */
import type { BaziResult } from '../l2/bazi.js';
import type { L4Output } from '../l4/l4.js';
import type { L5Output } from '../l5/l5.js';
import type { L7Output } from '../l7/l7.js';

export interface LifeLesson {
  title: string;
  content: string;
}

export interface L9Output {
  lifeLessons: LifeLesson[];
  essence: string;
  mantra: string;
  finalNote: string;
}

export function runL9(
  bazi: BaziResult,
  l4: L4Output,
  l5: L5Output,
  l7: L7Output,
): L9Output {
  const dominantWx = Object.entries(bazi.wuxingCount).sort((a, b) => b[1] - a[1])[0][0];
  const wxTheme: Record<string, string> = {
    木: '生长与创造——把成长本身当作目的，方向会自然浮现。',
    火: '表达与照亮——让你的热情被更多人看见，价值随之放大。',
    土: '承载与深耕——在稳定中积累，成果由时间沉淀而来。',
    金: '原则与精进——以高标准打磨作品，质量是最好的名片。',
    水: '洞察与流动——用敏锐看见趋势，用灵活适应变化。',
  };
  const nextDaYun = bazi.daYun.find((d) => d.index > (bazi.currentDaYun?.index ?? 0));
  const bestRenwei = [...l4.dimensions].sort((a, b) => b.renwei - a.renwei)[0];

  const lifeLessons: LifeLesson[] = [
    {
      title: `与「${l5.mainKnot}」和解`,
      content: `主卡点不是惩罚，而是提醒。练习本报告中给出的认知重构与化解动作，把它从「消耗」转化为「动力」。`,
    },
    {
      title: `借「${dominantWx}」之势`,
      content: wxTheme[dominantWx] ?? '善用自己的结构重心，把它变成持续优势。',
    },
    {
      title: `${nextDaYun ? `把握「${nextDaYun.ganzhi}」行运窗口` : '把握下一个行运窗口'}`,
      content: `${nextDaYun ? `未来一个阶段（${nextDaYun.startYear}-${nextDaYun.endYear}）是重要窗口，` : ''}结合 L6 分叉点，主动做出符合长期方向的选择。`,
    },
  ];

  return {
    lifeLessons,
    essence: `你的人为主动空间（50%）始终大于先天与流年之和。最好的策略只有一句话：认清倾向，然后主动选择。`,
    mantra: '命是地图，运是天气，路是自己走的。',
    finalNote:
      '声明：本报告基于传统命理框架生成，定位为文化娱乐与自我观察参考，不构成对未来的预测，亦不构成医疗、投资、法律等任何专业建议。人生结果由现实行动决定；若你正经历持续的情绪困扰，请务必寻求专业心理支持。',
  };
}
