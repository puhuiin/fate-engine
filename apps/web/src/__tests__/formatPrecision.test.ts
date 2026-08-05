import { describe, expect, it } from 'vitest';
import { formatPrecision } from '../components/ArchivesTable';

describe('formatPrecision 时间精度展示', () => {
  it('各档位映射为中文', () => {
    expect(formatPrecision('minute')).toBe('分钟');
    expect(formatPrecision('hour')).toBe('时辰');
    expect(formatPrecision('day')).toBe('日期');
    expect(formatPrecision('fuzzy')).toBe('模糊');
  });

  it('未知精度降级为模糊', () => {
    expect(formatPrecision('whatever')).toBe('模糊');
    expect(formatPrecision(undefined)).toBe('模糊');
  });
});
