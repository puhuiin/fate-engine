import { useState } from 'react';
import { buildExportText } from '../pages/report/layers';
import { buildPlainGuide, type PlainPoint } from '../pages/report/plain';
import type { L3Result, L5Result, L7Result, L9Result, RiskItem } from '../api/client';
import type { ReportDataState } from './useReportData';

/**
 * 报告页工具层 hook：封装「复制/下载报告文本」与三分钟白话导读构建逻辑，
 * 与数据加载（useReportData）解耦。
 */
export function useReportExport() {
  const [copied, setCopied] = useState(false);

  const fmtHour = (h: number): string => {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const buildGuide = (input: {
    trueSolarHours?: number;
    l3: L3Result | null;
    l5: L5Result | null;
    l7: L7Result | null;
    l9: L9Result | null;
    unlocked: boolean;
    risks: RiskItem[];
  }): PlainPoint[] => {
    return buildPlainGuide({
      trueSolar: input.trueSolarHours !== undefined ? fmtHour(input.trueSolarHours) : undefined,
      personality: input.l3?.personality,
      strengths: input.l3?.strengths,
      growth: input.l3?.growth,
      mainKnot: input.unlocked ? input.l5?.mainKnot : undefined,
      synthesis: input.unlocked ? input.l7?.synthesis : undefined,
      essence: input.unlocked ? input.l9?.essence : undefined,
      risk:
        input.unlocked && input.risks.length > 0
          ? `${input.risks[0].trigger_condition}（应对：${input.risks[0].mitigation}）`
          : undefined,
    });
  };

  const exportText = async (input: {
    data: ReportDataState;
    unlocked: boolean;
    risks: RiskItem[];
    recordId: number;
  }) => {
    const { data, unlocked, risks, recordId } = input;
    const text = buildExportText({
      l1: data.l1,
      l2: data.l2,
      l3: data.l3,
      l4: unlocked ? data.l4 : null,
      l5: unlocked ? data.l5 : null,
      l6: unlocked ? data.l6 : null,
      l7: unlocked ? data.l7 : null,
      l8: unlocked ? data.l8 : null,
      l9: unlocked ? data.l9 : null,
      risks,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fate-report-${recordId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return { copied, buildGuide, exportText };
}
