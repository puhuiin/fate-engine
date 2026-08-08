import { describe, expect, it } from 'vitest';
import type { L2Result, L4Result, L5Result, L6Result, L7Result, L9Result } from '../api/client';
import { deriveShishen, deriveSynergy, deriveXiJi, rankDimensions } from '../pages/report/derive';

function makeBazi(overrides: Partial<L2Result['bazi']>): L2Result['bazi'] {
  return {
    gender: 'male',
    dayMaster: { gan: '辛', wuxing: '金' },
    strength: '偏旺',
    wuxingCount: { 木: 0, 火: 1, 土: 3, 金: 2, 水: 2 },
    shishenStats: [
      { name: '比肩', count: 3 },
      { name: '伤官', count: 2 },
      { name: '正印', count: 2 },
      { name: '七杀', count: 2 },
      { name: '偏印', count: 2 },
      { name: '正财', count: 1 },
      { name: '食神', count: 1 },
    ],
    xunKong: { xun: '甲辰旬', kong: '寅卯' },
    taiYuan: '壬寅',
    mingGong: '庚子',
    daYun: [],
    currentDaYun: null,
    ...overrides,
  } as L2Result['bazi'];
}

describe('deriveXiJi 五行喜忌', () => {
  it('偏旺：宜克泄耗（克我/我生/我克），忌生扶（生我/同我）', () => {
    const r = deriveXiJi(makeBazi({}));
    expect(r.strength).toBe('偏旺');
    expect(r.xi).toEqual(['火', '水', '木']);
    expect(r.ji).toEqual(['土', '金']);
    expect(r.weakest).toEqual(['木', 0]);
    expect(r.strongest).toEqual(['土', 3]);
    expect(r.missing).toContain('木');
    expect(r.note).toContain('缺而无碍');
  });

  it('偏弱：宜生扶（生我/同我），忌克泄耗', () => {
    const r = deriveXiJi(
      makeBazi({
        dayMaster: { gan: '甲', wuxing: '木' },
        strength: '偏弱',
        wuxingCount: { 木: 3, 水: 2, 金: 1, 火: 0, 土: 1 },
      }),
    );
    expect(r.xi).toEqual(['水', '木']);
    expect(r.ji).toEqual(['金', '火', '土']);
    expect(r.note).toContain('宜「生扶」');
  });

  it('中和：补最弱，忌为空', () => {
    const r = deriveXiJi(
      makeBazi({
        dayMaster: { gan: '丙', wuxing: '火' },
        strength: '中和',
        wuxingCount: { 木: 2, 火: 2, 土: 2, 金: 2, 水: 0 },
      }),
    );
    expect(r.xi).toEqual(['水']);
    expect(r.ji).toEqual([]);
    expect(r.note).toContain('相对最弱之「水」');
  });
});

describe('deriveShishen 十神性格解读', () => {
  it('主用例：比劫/印星/食伤均超阈值，输出多条', () => {
    const out = deriveShishen(makeBazi({}));
    expect(out.some((t) => t.includes('比劫偏旺（3 处）'))).toBe(true);
    expect(out.some((t) => t.includes('印星偏旺（4 处）'))).toBe(true);
    expect(out.some((t) => t.includes('食伤偏旺（3 处）'))).toBe(true);
  });

  it('分布均衡：输出综合兜底', () => {
    const out = deriveShishen(
      makeBazi({
        shishenStats: [
          { name: '比肩', count: 1 },
          { name: '正印', count: 1 },
          { name: '食神', count: 1 },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('较为均衡');
  });
});

describe('rankDimensions 六维排序', () => {
  const l4 = {
    dimensions: [
      { key: 'a', name: '事业', xiantian: 1, liunian: 1, renwei: 1, total: 60, advice: '' },
      { key: 'b', name: '婚恋', xiantian: 1, liunian: 1, renwei: 1, total: 59, advice: '' },
      { key: 'c', name: '重大抉择', xiantian: 1, liunian: 1, renwei: 1, total: 70, advice: '' },
    ],
  } as unknown as L4Result;

  it('按综合分降序排列，标注最强最弱', () => {
    const { sorted, max, min } = rankDimensions(l4);
    expect(sorted.map((d) => d.name)).toEqual(['重大抉择', '事业', '婚恋']);
    expect(max.name).toBe('重大抉择');
    expect(min.name).toBe('婚恋');
  });
});

describe('deriveSynergy 跨层一致性洞察', () => {
  const l4 = {
    dimensions: [
      { key: 'a', name: '重大抉择', xiantian: 1, liunian: 1, renwei: 1, total: 70, advice: '' },
      { key: 'b', name: '婚恋', xiantian: 1, liunian: 1, renwei: 1, total: 59, advice: '' },
    ],
  } as unknown as L4Result;
  const l5 = { mainKnot: '求认可与自我证明' } as unknown as L5Result;
  const l6 = {
    lines: [
      { key: 't', name: '转型线 · 进化者', fit: 100 },
      { key: 's', name: '安稳线', fit: 70 },
    ],
  } as unknown as L6Result;
  const l7 = { coreNote: '命主具有极强的自我实现驱动力' } as unknown as L7Result;
  const l9 = { essence: '以认知升级为引擎完成自我迭代' } as unknown as L9Result;

  it('输出短板/优势/内核三条洞察', () => {
    const out = deriveSynergy(l4, l5, l6, l7, l9);
    expect(out).toHaveLength(3);
    expect(out[0].label).toBe('短板闭环');
    expect(out[0].text).toContain('婚恋');
    expect(out[0].text).toContain('求认可与自我证明');
    expect(out[1].text).toContain('重大抉择');
    expect(out[1].text).toContain('转型线 · 进化者');
    expect(out[2].label).toBe('内核自洽');
  });
});
