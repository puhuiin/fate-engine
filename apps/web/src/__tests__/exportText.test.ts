import { describe, expect, it } from 'vitest';
import { buildExportText, fmtHour } from '../pages/report/exportText';
import type { L1Result, L4Result, L6Result, L8Result, RiskItem } from '../api/client';

const l1 = {
  normalized: {
    solarDate: '2002-11-29',
    solarTime: '20:40',
    timeKnown: true,
    timePrecision: 'minute',
  },
  location: null,
  timeCorrection: {
    meanSolarHours: 20.67,
    equationOfTimeMinutes: -4,
    trueSolarHours: 20.604,
    offsetMinutes: -4,
    crossDay: false,
  },
  shichen: { name: '戌时', branch: 'xu' },
  lunar: {
    lunarDate: '十月廿五',
    yearGanZhi: '壬午',
    monthGanZhi: '辛亥',
    dayGanZhi: '辛丑',
    timeGanZhi: '戊戌',
    yearAnimal: '马',
    currentJieQi: '小雪',
    prevJieQi: null,
    nextJieQi: null,
    jieQiNote: '',
  },
  boundaryRisk: false,
  dstAdjustment: { applied: false, original: '', adjusted: '', note: '' },
  rating: { grade: 'A', confidence: 90, message: '', suggest: [] },
} as unknown as L1Result;

describe('fmtHour 小时格式化', () => {
  it('20.604 小时 → 20:36', () => {
    expect(fmtHour(20.604)).toBe('20:36');
  });
  it('整点与跨日归一', () => {
    expect(fmtHour(0)).toBe('00:00');
    expect(fmtHour(23.999)).toBe('00:00');
  });
});

describe('buildExportText 报告导出', () => {
  it('空报告仍有标题与免责声明', () => {
    const text = buildExportText({
      l1: null,
      l2: null,
      l3: null,
      l4: null,
      l5: null,
      l6: null,
      l7: null,
      l8: null,
      l9: null,
      risks: [],
    });
    expect(text).toContain('全域超验 · 命运演算 报告');
    expect(text).toContain('仅供文化娱乐与自我观察参考');
  });

  it('包含 L1 时空校正关键信息', () => {
    const text = buildExportText({
      l1,
      l2: null,
      l3: null,
      l4: null,
      l5: null,
      l6: null,
      l7: null,
      l8: null,
      l9: null,
      risks: [],
    });
    expect(text).toContain('【L1 时空校正】');
    expect(text).toContain('2002-11-29 20:40');
    expect(text).toContain('真太阳时：20:36');
    expect(text).toContain('辛丑');
  });

  it('L4 权重按百分比格式化', () => {
    const l4 = {
      weightModel: { xiantian: 0.3, liunian: 0.2, renwei: 0.5, note: '' },
      dimensions: [
        {
          key: 'career',
          name: '事业',
          xiantian: 60,
          liunian: 70,
          renwei: 80,
          total: 68,
          advice: '稳中求进',
        },
      ],
      summary: '综合尚可',
    } as unknown as L4Result;
    const text = buildExportText({
      l1: null,
      l2: null,
      l3: null,
      l4,
      l5: null,
      l6: null,
      l7: null,
      l8: null,
      l9: null,
      risks: [],
    });
    expect(text).toContain('先天30% / 流年20% / 人为50%');
    expect(text).toContain('事业：68（稳中求进）');
  });

  it('L8 七级方案逐条输出', () => {
    const l8 = {
      levels: [
        {
          level: 1,
          name: '环境布局',
          items: [{ title: '整理书桌', content: '清理桌面', execCycle: '每周' }],
        },
      ],
      note: '由外到内',
    } as unknown as L8Result;
    const text = buildExportText({
      l1: null,
      l2: null,
      l3: null,
      l4: null,
      l5: null,
      l6: null,
      l7: null,
      l8,
      l9: null,
      risks: [],
    });
    expect(text).toContain('【L8 七级改运】');
    expect(text).toContain('L1 环境布局');
    expect(text).toContain('整理书桌（每周）：清理桌面');
  });

  it('风险项以 Lv 等级前缀输出', () => {
    const risks = [
      { risk_level: 4, year: '2031', trigger_condition: '换轨期', mitigation: '分批落地' },
    ] as unknown as RiskItem[];
    const text = buildExportText({
      l1: null,
      l2: null,
      l3: null,
      l4: null,
      l5: null,
      l6: null,
      l7: null,
      l8: null,
      l9: null,
      risks,
    });
    expect(text).toContain('【风险提示】');
    expect(text).toContain('Lv4/5（2031）：换轨期｜应对：分批落地');
  });

  it('导读段包含 L6 多线概览（与页面导读一致）', () => {
    const text = buildExportText({
      l1: null,
      l2: null,
      l3: null,
      l4: null,
      l5: null,
      l6: {
        lines: [
          { name: '修行', fit: 100, strategy: '向内求索' },
          { name: '事业', fit: 61, strategy: '稳扎稳打' },
        ],
        branchPoints: [],
        note: '',
      } as unknown as L6Result,
      l7: null,
      l8: null,
      l9: null,
      risks: [],
    });
    expect(text).toContain('【先看这里：三分钟读懂报告】');
    expect(text).toContain('【多线】四条命运线的契合参考');
    expect(text).toContain('修行（契合 100）：向内求索');
  });

  it('未解锁时追加深度层标注，解锁后不追加', () => {
    const input = { l1: null, l2: null, l3: null, l4: null, l5: null, l6: null, l7: null, l8: null, l9: null, risks: [] };
    const locked = buildExportText(input, { unlocked: false });
    const unlockedText = buildExportText(input, { unlocked: true });
    const defaultText = buildExportText(input);
    expect(locked).toContain('【深度层未解锁】');
    expect(locked).toContain('L4-L9');
    expect(unlockedText).not.toContain('【深度层未解锁】');
    expect(defaultText).not.toContain('【深度层未解锁】');
  });
});
