/**
 * 风险项落库（risk_item 表）：
 * L5 因果卡点 → 结构性风险（risk_level 3），L6 分叉点 → 时点性风险（risk_level 4）。
 * 表述全部沿用 L5/L6 合规文案（可解、可成长），红线：禁止恐吓话术。
 */
import type { Db } from '../../db/client.js';
import type { L5Output } from '../l5/l5.js';
import type { L6Output } from './l6.js';

export function insertRiskItems(db: Db, recordId: number, l5: L5Output, l6: L6Output): void {
  const stmt = db.prepare(
    'INSERT INTO risk_item (record_id, year, risk_level, trigger_condition, mitigation) VALUES (?, ?, ?, ?, ?)',
  );
  for (const p of l5.karmaPatterns) {
    stmt.run(
      recordId,
      null,
      3,
      p.manifestation,
      `${p.root} 化解方向：${l5.resolutionPath.join('；')}`,
    );
  }
  for (const b of l6.branchPoints) {
    stmt.run(
      recordId,
      String(b.year),
      4,
      b.context,
      `方案A（${b.decisionA}）→ ${b.pathA}；方案B（${b.decisionB}）→ ${b.pathB}`,
    );
  }
}
