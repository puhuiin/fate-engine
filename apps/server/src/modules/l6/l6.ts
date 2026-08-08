/**
 * L6 量子多线（V6）
 * 四条平行命运线对比 + 关键分叉点提醒。
 * 核心理念：未来不是一条被写死的轨道，而是由关键选择决定的开放树状结构；
 * 四条线均为同等可能，权重由行动决定。红线约定：禁止宿命论，禁止恐吓。
 * V6：深度模式（quantum/ultimate）下结合用神五行与大运干支生克给出分叉点研判。
 */
import type { BaziResult } from '../l2/bazi.js';
import type { L4Output } from '../l4/l4.js';
import type { L5Output } from '../l5/l5.js';
import { runDeepAnalysis } from '../l2/deep.js';

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
  /** 深度模式（quantum/ultimate）下：用神与大运生克研判（倾向性文化参考） */
  insight?: string;
}

export interface L6Output {
  lines: ParallelLine[];
  branchPoints: BranchPoint[];
  note: string;
  /** 仅深度模式（quantum/ultimate）输出：各条线未来行运窗口提示 */
  depthWindows?: Array<{ line: string; windows: string[] }>;
}

export type L6Depth = 'standard' | 'quantum' | 'ultimate';

export function runL6(
  bazi: BaziResult,
  l4: L4Output,
  l5: L5Output,
  depth: L6Depth = 'standard',
): L6Output {
  const wc = bazi.wuxingCount;
  const countOf = (name: string) => bazi.shishenStats.find((s) => s.name === name)?.count ?? 0;
  const socialScore = l4.dimensions.find((d) => d.key === 'social')?.renwei ?? 55;
  const decisionScore = l4.dimensions.find((d) => d.key === 'decision')?.renwei ?? 55;
  const yongShen = runDeepAnalysis(bazi).yongShen.yong;

  // 四条线的契合度（从结构映射）
  const raw = {
    stable: (wc['土'] ?? 0) + (wc['金'] ?? 0),
    breakout: (wc['木'] ?? 0) + (wc['火'] ?? 0) + countOf('七杀') + countOf('伤官'),
    synergy: countOf('比肩') + countOf('劫财') + (wc['水'] ?? 0) + socialScore / 30,
    transform:
      countOf('正印') + countOf('偏印') + (wc['水'] ?? 0) + (wc['木'] ?? 0) + decisionScore / 30,
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

  // 分叉点：按后续大运转换年份生成。深度模式分叉点更密（quantum=5 步、ultimate=全部）
  const future = bazi.daYun.filter((d) => d.index > (bazi.currentDaYun?.index ?? 0));
  const top = [...lines].sort((a, b) => b.fit - a.fit);
  const branchDepth = depth === 'ultimate' ? future.length : depth === 'quantum' ? 5 : 3;

  // 大运天干五行（取干支首字）
  const GAN_WX: Record<string, string> = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
  };
  // 用神与大运干支生克研判（倾向性）
  const dayunInsight = (gan: string): string => {
    const wx = GAN_WX[gan];
    if (!wx || !yongShen) return '';
    const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    if (wx === yongShen) return `此运天干${gan}（${wx}）与用神同气，倾向性上更顺，可放心深耕（文化参考）。`;
    if (SHENG[wx] === yongShen) return `此运天干${gan}（${wx}）生用神，倾向性上是补位之运，适合借势投入（文化参考）。`;
    if (KE[wx] === yongShen) return `此运天干${gan}（${wx}）克用神，传统称为「逆气」，宜稳不宜冒进，多留调整余地（文化参考）。`;
    return `此运天干${gan}（${wx}）与用神为泄耗关系，节奏上适合休整积累，不宜急于扩张（文化参考）。`;
  };

  const branchPoints: BranchPoint[] = future.slice(0, branchDepth).map((dy) => ({
    age: dy.startAge,
    year: dy.startYear,
    context: `进入「${dy.ganzhi}」大运（${dy.startAge}岁起，${dy.startYear}-${dy.endYear}）`,
    decisionA: `在事业或主赛道上做一次「加注」式深耕投入`,
    pathA: top[0]?.name ?? '稳进线 · 深耕者',
    decisionB: `围绕一个跨领域机会做一次「转型」式尝试`,
    pathB: top[1]?.name ?? '破局线 · 开创者',
    ...(depth !== 'standard' ? { insight: dayunInsight(dy.ganzhi[0]) } : {}),
  }));

  // 深度模式附加：每条线的后续行运窗口（把大运转换年映射到各线契合策略）
  const depthWindows: L6Output['depthWindows'] =
    depth === 'standard'
      ? undefined
      : lines.map((ln) => ({
          line: ln.name,
          windows: future
            .slice(0, depth === 'quantum' ? 3 : 5)
            .map((dy) => `${dy.startYear}-${dy.endYear}（${dy.ganzhi}）`),
        }));

  return {
    lines,
    branchPoints,
    depthWindows,
    note: `多线说明：四条线只是「可能的路径」，权重取决于你在每个分叉点的行动与投入，而非先天注定。${l5.mainKnot}是当前最需要留意的变量，无论走哪条线，先把它纳入你的刻意练习清单。${depth !== 'standard' ? `深度模式已展开 ${branchPoints.length} 个分叉点并附各行运窗口，供长期规划参考。` : ''}`,
  };
}
