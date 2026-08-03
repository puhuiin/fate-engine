/**
 * L6 量子多线（V5）
 * 四条平行命运线对比 + 关键分叉点提醒。
 * 核心理念：未来不是一条被写死的轨道，而是由关键选择决定的开放树状结构；
 * 四条线均为同等可能，权重由行动决定。红线约定：禁止宿命论，禁止恐吓。
 */
import type { BaziResult } from '../l2/bazi.js';
import type { L4Output } from '../l4/l4.js';
import type { L5Output } from '../l5/l5.js';

export interface ParallelLine {
  key: string;
  name: string;
  strategy: string;
  fit: number; // 0-100 相对契合度
  trigger: string; // 进入该线的典型条件
  risk: string; // 风险提示与应对（温和）
}

export interface BranchPoint {
  age: number;
  year: number;
  context: string; // 行运背景
  decisionA: string;
  pathA: string;
  decisionB: string;
  pathB: string;
}

export interface L6Output {
  lines: ParallelLine[];
  branchPoints: BranchPoint[];
  note: string;
}

export function runL6(bazi: BaziResult, l4: L4Output, l5: L5Output): L6Output {
  const wc = bazi.wuxingCount;
  const countOf = (name: string) => bazi.shishenStats.find((s) => s.name === name)?.count ?? 0;
  const socialScore = l4.dimensions.find((d) => d.key === 'social')?.renwei ?? 55;
  const decisionScore = l4.dimensions.find((d) => d.key === 'decision')?.renwei ?? 55;

  // 四条线的契合度（从结构映射）
  const raw = {
    stable: (wc['土'] ?? 0) + (wc['金'] ?? 0),
    breakout: (wc['木'] ?? 0) + (wc['火'] ?? 0) + countOf('七杀') + countOf('伤官'),
    synergy: (countOf('比肩') + countOf('劫财')) + (wc['水'] ?? 0) + socialScore / 30,
    transform:
      (countOf('正印') + countOf('偏印')) + (wc['水'] ?? 0) + (wc['木'] ?? 0) + decisionScore / 30,
  };
  const maxRaw = Math.max(...Object.values(raw), 1);
  const fitOf = (k: keyof typeof raw) => Math.round((raw[k] / maxRaw) * 100);

  const lines: ParallelLine[] = [
    {
      key: 'stable',
      name: '稳进线 · 深耕者',
      strategy: '依托擅长与稳定赛道，用长期主义把一件事做深做透，靠复利与口碑取胜。',
      fit: fitOf('stable'),
      trigger: '选择在已有领域深耕，坚持标准、控制节奏，把执行力转化为护城河。',
      risk: '避免因过于求稳而错过环境变化；定期主动引入外部视角校准方向。',
    },
    {
      key: 'breakout',
      name: '破局线 · 开创者',
      strategy: '主动跨界与创新，把风险当作信息，用新打法开辟增量空间。',
      fit: fitOf('breakout'),
      trigger: '选择在关键节点切换到新领域或新赛道，敢于试错并快速迭代。',
      risk: '控制试错成本，为每次冒险预设退出条件；避免单点押注。',
    },
    {
      key: 'synergy',
      name: '协同线 · 连接者',
      strategy: '借力关系与资源网络，靠合作与信任杠杆放大个人成果。',
      fit: fitOf('synergy'),
      trigger: '选择主动经营人脉与协作关系，在团队与平台中借势成长。',
      risk: '警惕过度依赖他人而弱化核心竞争力；关键能力仍要长在自己身上。',
    },
    {
      key: 'transform',
      name: '转型线 · 进化者',
      strategy: '以认知升级为引擎，通过持续学习与自我迭代切换更高价值赛道。',
      fit: fitOf('transform'),
      trigger: '选择把学习与自省作为主线，在人生中场完成能力重构与转型。',
      risk: '避免陷入「一直准备、从不启动」；学习必须绑定具体产出。',
    },
  ];

  // 分叉点：按后续大运转换年份生成
  const future = bazi.daYun.filter((d) => d.index > (bazi.currentDaYun?.index ?? 0));
  const top = [...lines].sort((a, b) => b.fit - a.fit);
  const branchPoints: BranchPoint[] = future.slice(0, 3).map((dy) => ({
    age: dy.startAge,
    year: dy.startYear,
    context: `进入「${dy.ganzhi}」大运（${dy.startAge}岁起，${dy.startYear}-${dy.endYear}）`,
    decisionA: `在事业或主赛道上做一次「加注」式深耕投入`,
    pathA: top[0]?.name ?? '稳进线 · 深耕者',
    decisionB: `围绕一个跨领域机会做一次「转型」式尝试`,
    pathB: top[1]?.name ?? '破局线 · 开创者',
  }));

  return {
    lines,
    branchPoints,
    note: `多线说明：四条线只是「可能的路径」，权重取决于你在每个分叉点的行动与投入，而非先天注定。${l5.mainKnot}是当前最需要留意的变量，无论走哪条线，先把它纳入你的刻意练习清单。`,
  };
}
