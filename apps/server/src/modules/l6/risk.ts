/**
 * 风险项落库行映射（risk_item 表）：
 * L5 因果卡点 → 结构性风险（risk_level 3），L6 分叉点 → 时点性风险（risk_level 4）。
 * 表述全部沿用 L5/L6 合规文案（可解、可成长），红线：禁止恐吓话术。
 * 纯映射函数，实际写库由数据层 repos.risks.insertBatch 完成。
 */
import type { L5Output } from '../l5/l5.js';
import type { L6Output } from './l6.js';

export interface RiskRowInput {
  year: string | null;
  riskLevel: number;
  trigger: string;
  mitigation: string;
}

export function toRiskRows(l5: L5Output, l6: L6Output): RiskRowInput[] {
  return [
    ...l5.karmaPatterns.map((p) => ({
      year: null as string | null,
      riskLevel: 3,
      trigger: p.manifestation,
      mitigation: `${p.root} 化解方向：${l5.resolutionPath.join('；')}`,
    })),
    ...l6.branchPoints.map((b) => ({
      year: String(b.year),
      riskLevel: 4,
      trigger: b.context,
      mitigation: `方案A（${b.decisionA}）→ ${b.pathA}；方案B（${b.decisionB}）→ ${b.pathB}`,
    })),
  ];
}
