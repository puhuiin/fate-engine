// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReportExport } from '../hooks/useReportExport';
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
  RiskItem,
} from '../api/client';
import type { ReportDataState } from '../hooks/useReportData';

const layers = vi.hoisted(() => ({ buildExportText: vi.fn() }));
const plain = vi.hoisted(() => ({ buildPlainGuide: vi.fn() }));

vi.mock('../pages/report/layers', () => layers);
vi.mock('../pages/report/plain', () => plain);

const l3 = {
  disenchantNote: 'n',
  personality: [{ dimension: '宜人性', score: 70, desc: '温和' }],
  strengths: ['共情'],
  growth: ['决策'],
  behaviorLogic: 'b',
} as unknown as L3Result;

const l5 = {
  karmaPatterns: [{ name: 'k', cause: 'c', manifestation: 'm', root: 'r' }],
  mainKnot: '自我设限',
  resolutionPath: ['p'],
  note: 'n',
} as unknown as L5Result;

const l6 = {
  lines: [
    {
      key: 'career',
      name: '事业线',
      strategy: '稳中求进',
      fit: 100,
      trigger: 't',
      risk: 'r',
    },
  ],
  branchPoints: [
    {
      age: 30,
      year: 2032,
      context: 'c',
      decisionA: 'a',
      pathA: 'pa',
      decisionB: 'b',
      pathB: 'pb',
    },
  ],
  note: 'n',
} as unknown as L6Result;

const l7 = {
  metaRules: ['m'],
  conflictResolution: [{ conflict: 'c', ruling: 'r', basis: 'b' }],
  synthesis: ['综合判断'],
  coreNote: 'n',
} as unknown as L7Result;

const l9 = {
  lifeLessons: [{ title: 't', content: 'c' }],
  essence: '回归本心',
  mantra: 'm',
  finalNote: 'n',
} as unknown as L9Result;

const risk: RiskItem = {
  id: 1,
  record_id: 1,
  year: '2028',
  risk_level: 4,
  trigger_condition: '多思多虑',
  mitigation: '记录倾诉',
};

const data: ReportDataState = {
  l1: { marker: 'l1' } as unknown as L1Result,
  l2: { marker: 'l2' } as unknown as L2Result,
  l3,
  l4: { marker: 'l4' } as unknown as L4Result,
  l5,
  l6,
  l7,
  l8: { marker: 'l8' } as unknown as L8Result,
  l9,
};

beforeEach(() => {
  vi.clearAllMocks();
  plain.buildPlainGuide.mockReturnValue([]);
  layers.buildExportText.mockReturnValue('报告全文');
});

describe('useReportExport fmtHour 真太阳时格式化', () => {
  it('20.604 → 20:36（四舍五入到分）', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 20.604,
        l3,
        l5: null,
        l6: null,
        l7: null,
        l9: null,
        unlocked: false,
        risks: [],
      });
    });
    expect(plain.buildPlainGuide).toHaveBeenCalledWith(
      expect.objectContaining({ trueSolar: '20:36' }),
    );
  });

  it('23.99 → 23:59 上界', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 23.99,
        l3,
        l5: null,
        l6: null,
        l7: null,
        l9: null,
        unlocked: false,
        risks: [],
      });
    });
    expect(plain.buildPlainGuide).toHaveBeenCalledWith(
      expect.objectContaining({ trueSolar: '23:59' }),
    );
  });

  it('24.0 → 00:00（跨日回卷）', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 24,
        l3,
        l5: null,
        l6: null,
        l7: null,
        l9: null,
        unlocked: false,
        risks: [],
      });
    });
    expect(plain.buildPlainGuide).toHaveBeenCalledWith(
      expect.objectContaining({ trueSolar: '00:00' }),
    );
  });

  it('0.437 → 00:26（凌晨小数）', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 0.437,
        l3,
        l5: null,
        l6: null,
        l7: null,
        l9: null,
        unlocked: false,
        risks: [],
      });
    });
    expect(plain.buildPlainGuide).toHaveBeenCalledWith(
      expect.objectContaining({ trueSolar: '00:26' }),
    );
  });
});

describe('useReportExport buildGuide 锁定/解锁装配', () => {
  it('未解锁：深层数据全部不下发', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 20.6,
        l3,
        l5,
        l6,
        l7,
        l9,
        unlocked: false,
        risks: [risk],
      });
    });
    expect(plain.buildPlainGuide).toHaveBeenCalledWith(
      expect.objectContaining({
        trueSolar: expect.any(String),
        personality: expect.any(Array),
        lines: undefined,
        mainKnot: undefined,
        synthesis: undefined,
        essence: undefined,
        risk: undefined,
      }),
    );
  });

  it('解锁：下发 lines 映射与深度卡点/综合/本质', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 20.6,
        l3,
        l5,
        l6,
        l7,
        l9,
        unlocked: true,
        risks: [],
      });
    });
    const call = plain.buildPlainGuide.mock.calls[0][0];
    expect(call.lines).toEqual([{ name: '事业线', fit: 100, strategy: '稳中求进' }]);
    expect(call.mainKnot).toBe('自我设限');
    expect(call.synthesis).toEqual(['综合判断']);
    expect(call.essence).toBe('回归本心');
    expect(call.risk).toBeUndefined();
  });

  it('解锁且有风险：risk 拼接触发条件与应对', () => {
    const { result } = renderHook(() => useReportExport());
    act(() => {
      result.current.buildGuide({
        trueSolarHours: 20.6,
        l3,
        l5,
        l6,
        l7,
        l9,
        unlocked: true,
        risks: [risk],
      });
    });
    expect(plain.buildPlainGuide).toHaveBeenCalledWith(
      expect.objectContaining({ risk: '多思多虑（应对：记录倾诉）' }),
    );
  });
});

describe('useReportExport exportText', () => {
  it('剪贴板成功：copied 置位并在 2s 后复位', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { result } = renderHook(() => useReportExport());
    await act(async () => {
      await result.current.exportText({ data, unlocked: true, risks: [risk], recordId: 42 });
    });
    expect(writeText).toHaveBeenCalledWith('报告全文');
    expect(result.current.copied).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });

  it('解锁导出：深层层数据透传给 buildExportText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { result } = renderHook(() => useReportExport());
    await act(async () => {
      await result.current.exportText({ data, unlocked: true, risks: [risk], recordId: 42 });
    });
    const [report, opts] = layers.buildExportText.mock.calls[0] as [
      Record<string, unknown>,
      { unlocked: boolean },
    ];
    expect(opts.unlocked).toBe(true);
    expect(report.l4).not.toBeNull();
    expect(report.l6).not.toBeNull();
    expect(report.l9).not.toBeNull();
  });

  it('未解锁导出：深层层数据置 null', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { result } = renderHook(() => useReportExport());
    await act(async () => {
      await result.current.exportText({ data, unlocked: false, risks: [], recordId: 42 });
    });
    const [report, opts] = layers.buildExportText.mock.calls[0] as [
      Record<string, unknown>,
      { unlocked: boolean },
    ];
    expect(opts.unlocked).toBe(false);
    expect(report.l4).toBeNull();
    expect(report.l5).toBeNull();
    expect(report.l9).toBeNull();
    expect(report.l3).not.toBeNull();
  });

  it('剪贴板失败：回退 Blob 下载且文件名含记录 ID', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { result } = renderHook(() => useReportExport());
    await act(async () => {
      await result.current.exportText({ data, unlocked: true, risks: [risk], recordId: 7 });
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(result.current.copied).toBe(false);
  });
});
