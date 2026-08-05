import type {
  L1Result,
  L2Result,
  L3Result,
  L4Result,
  L5Result,
  L6Result,
  L7Result,
  L8Result,
  L9Result,
} from '../../api/client';
import type { RiskItem } from '../../api/client';
import { buildPlainGuide } from './plain';

export function fmtHour(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface ExportInput {
  l1: L1Result | null;
  l2: L2Result | null;
  l3: L3Result | null;
  l4: L4Result | null;
  l5: L5Result | null;
  l6: L6Result | null;
  l7: L7Result | null;
  l8: L8Result | null;
  l9: L9Result | null;
  risks: RiskItem[];
}

/** 导出完整报告为纯文本（仅已解锁层，调用方负责传 null 遮罩） */
export function buildExportText(r: ExportInput): string {
  const lines: string[] = [];
  lines.push('全域超验 · 命运演算 报告', '='.repeat(30));

  const guide = buildPlainGuide({
    trueSolar: r.l1 ? fmtHour(r.l1.timeCorrection.trueSolarHours) : undefined,
    personality: r.l3?.personality,
    strengths: r.l3?.strengths,
    growth: r.l3?.growth,
    mainKnot: r.l5?.mainKnot,
    synthesis: r.l7?.synthesis,
    essence: r.l9?.essence,
    risk:
      r.risks.length > 0
        ? `${r.risks[0].trigger_condition}（应对：${r.risks[0].mitigation}）`
        : undefined,
  });
  if (guide.length > 0) {
    lines.push('【先看这里：三分钟读懂报告】');
    for (const pt of guide) lines.push(`- 【${pt.tag}】${pt.title}：${pt.text}`);
    lines.push('', '以上为启发式文化解读，仅供自我观察参考，不作任何决策依据。', '');
  }

  if (r.l1) {
    const t = r.l1.timeCorrection;
    lines.push(
      '【L1 时空校正】',
      `城市：${r.l1.location?.cityName ?? '未提供'}（经度 ${r.l1.location?.longitude ?? '-'}°）`,
    );
    lines.push(`钟表时间：${r.l1.normalized.solarDate} ${r.l1.normalized.solarTime}`);
    lines.push(
      `真太阳时：${fmtHour(t.trueSolarHours)}（总校正 ${t.totalOffsetMinutes ?? t.offsetMinutes} 分钟）`,
    );
    lines.push(
      `时辰：${r.l1.shichen.name}`,
      `农历：${r.l1.lunar.lunarDate}`,
      `四柱：${r.l1.lunar.yearGanZhi} ${r.l1.lunar.monthGanZhi} ${r.l1.lunar.dayGanZhi} ${r.l1.lunar.timeGanZhi}`,
    );
    lines.push(`误差等级：${r.l1.rating.grade}（置信度 ${r.l1.rating.confidence}%）`, '');
  }
  if (r.l2) {
    lines.push('【L2 术数算力】');
    for (const s of r.l2.schools) lines.push(`- ${s.school}（${s.version}）：${s.note}`);
    const b = r.l2.bazi;
    lines.push(
      `日主：${b.dayMaster.gan}（${b.dayMaster.wuxing}）· ${b.strength}`,
      `五行：${Object.entries(b.wuxingCount)
        .map(([k, v]) => `${k}${v}`)
        .join(' ')}`,
      '',
    );
  }
  if (r.l3) {
    lines.push('【L3 科学祛魅】', r.l3.disenchantNote);
    lines.push(`人格维度：${r.l3.personality.map((p) => `${p.dimension}${p.score}`).join(' ')}`);
    lines.push(`天赋：${r.l3.strengths.join('、')}`, `可发展：${r.l3.growth.join('、')}`, '');
  }
  if (r.l4) {
    lines.push(
      '【L4 六维落地】',
      `权重：先天${r.l4.weightModel.xiantian * 100}% / 流年${r.l4.weightModel.liunian * 100}% / 人为${r.l4.weightModel.renwei * 100}%`,
    );
    for (const d of r.l4.dimensions) lines.push(`- ${d.name}：${d.total}（${d.advice}）`);
    lines.push('', r.l4.summary, '');
  }
  if (r.l5) {
    lines.push('【L5 因果溯源】', `主卡点：${r.l5.mainKnot}`);
    for (const k of r.l5.karmaPatterns) lines.push(`- ${k.name}：${k.root}`);
    lines.push('', `化解：${r.l5.resolutionPath.join('；')}`, '');
  }
  if (r.l6) {
    lines.push('【L6 量子多线】');
    for (const ln of r.l6.lines) lines.push(`- ${ln.name}（契合 ${ln.fit}）：${ln.strategy}`);
    for (const bp of r.l6.branchPoints)
      lines.push(
        `分叉点 ${bp.year}：A=${bp.decisionA}→${bp.pathA} / B=${bp.decisionB}→${bp.pathB}`,
      );
    if (r.l6.depthWindows && r.l6.depthWindows.length > 0) {
      lines.push('各线行运窗口（深度模式）：');
      for (const w of r.l6.depthWindows) lines.push(`- ${w.line}：${w.windows.join(' → ')}`);
    }
    lines.push('', r.l6.note, '');
  }
  if (r.risks.length > 0) {
    lines.push('【风险提示】');
    for (const rk of r.risks)
      lines.push(
        `- Lv${rk.risk_level}/5${rk.year ? `（${rk.year}）` : ''}：${rk.trigger_condition}｜应对：${rk.mitigation}`,
      );
    lines.push('');
  }
  if (r.l7) {
    lines.push('【L7 元规则内核】');
    for (const s of r.l7.synthesis) lines.push(`- ${s}`);
    lines.push('', r.l7.coreNote, '');
  }
  if (r.l8) {
    lines.push('【L8 七级改运】');
    for (const lv of r.l8.levels) {
      lines.push(`L${lv.level} ${lv.name}`);
      for (const it of lv.items) lines.push(`  - ${it.title}（${it.execCycle}）：${it.content}`);
    }
    lines.push('', r.l8.note, '');
  }
  if (r.l9) {
    lines.push('【L9 实相兜底】');
    for (const l of r.l9.lifeLessons) lines.push(`- ${l.title}：${l.content}`);
    lines.push('', `核心要义：${r.l9.essence}`, `箴言：${r.l9.mantra}`, '', r.l9.finalNote);
  }
  lines.push('', '='.repeat(30), '仅供文化娱乐与自我观察参考。');
  return lines.join('\n');
}
