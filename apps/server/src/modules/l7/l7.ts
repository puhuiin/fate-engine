/**
 * L7 元规则内核（V6）
 * 多体系冲突统一裁定 + 综合结论生成。
 * 内核规则：以日主为纲、纳音为参；人为权重过半；结论版本化、可迭代。
 * PRD：外层版本冻结，内核预留迭代入口（L8 自演化）。
 */
import type { L1Output } from '../l1/l1.js';
import type { L2Output } from '../l2/l2.js';
import type { L4Output } from '../l4/l4.js';
import type { L5Output } from '../l5/l5.js';

export interface ConflictResolution {
  conflict: string;
  ruling: string;
  basis: string;
}

export interface L7Output {
  metaRules: string[];
  conflictResolution: ConflictResolution[];
  synthesis: string[];
  coreNote: string;
}

export function runL7(l1: L1Output, l2: L2Output, l4: L4Output, l5: L5Output): L7Output {
  const bazi = l2.bazi;

  const metaRules = [
    '裁定顺序：先天结构（L2）→ 人格祛魅（L3）→ 权重量化（L4）→ 因果溯源（L5），低层数据只作为高层的输入参考。',
    '跨流派冲突：以日主（日干五行）为纲，纳音取象为参；日主主「行事内核」，纳音主「外在质感」。',
    '人为权重过半：任何综合结论都必须同时给出「人为可作用项」，否则视为无效结论。',
  ];

  const dayNaYinWx =
    (l2.schools.find((s) => s.school === '纳音五行论命')?.data as { dayNaYinWuXing?: string })
      ?.dayNaYinWuXing ?? '';
  const conflictResolution: ConflictResolution[] = l2.conflicts.map((c) => ({
    conflict: c,
    ruling:
      bazi.dayMaster.wuxing === dayNaYinWx
        ? '两派主星五行一致，直接归一，无需额外裁定。'
        : `裁定：以日主（${bazi.dayMaster.gan}，五行${bazi.dayMaster.wuxing}）为纲确定行事内核，纳音（五行${dayNaYinWx}）仅作外在质感参考。`,
    basis: '元规则第 2 条：日主为纲、纳音为参。',
  }));

  const topDimension = [...l4.dimensions].sort((a, b) => b.renwei - a.renwei)[0];
  const highManMade = [...l4.dimensions].filter((d) => d.renwei >= 60);

  const synthesis = [
    `先天层面：日主${bazi.dayMaster.gan}（五行${bazi.dayMaster.wuxing}），四柱五行${bazi.strength}，以「${Object.entries(bazi.wuxingCount).sort((a, b) => b[1] - a[1])[0][0]}」为重心；L1 误差等级 ${l1.rating.grade}、置信度 ${l1.rating.confidence}%，结论强度以置信度为准。`,
    `流年层面：当前处「${bazi.currentDaYun?.ganzhi ?? '-'}」大运（${bazi.currentDaYun?.startYear ?? '-'}-${bazi.currentDaYun?.endYear ?? '-'}），行运节奏以「${l4.dimensions[0].liunian}」为基线，配合六维流年分综合研判。`,
    `人为层面：六维中人为可控分全部 ≥${Math.min(...l4.dimensions.map((d) => d.renwei))}，其中「${topDimension.name}」主动空间最大；人为权重 50% 恒定过半。`,
    `卡点层面：主卡点为「${l5.mainKnot}」，化解路径已在 L5 给出，纳入 L8 七级方案执行。`,
    `行动方向：${highManMade.length ? `优先强化「${highManMade.map((d) => d.name).join('、')}」维度的主动作为` : '全面推进七级改运方案'}，以 30 天为一个观察周期复盘。`,
  ];

  return {
    metaRules,
    conflictResolution,
    synthesis,
    coreNote:
      '内核声明：本报告所有结论均由固定版本规则生成（L1 V2 / L2 V1 / L3 V3 / L4 V3+V14 / L5 V4 / L7 V6 / L8 V13），外层版本冻结以保障一致性；内核保留迭代入口，规则升级走 kernel_log 记录与版本号递增，不影响已出报告的可追溯性。',
  };
}
