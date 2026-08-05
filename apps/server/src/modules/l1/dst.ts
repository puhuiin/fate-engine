/**
 * 中国夏令时（Daylight Saving Time）校正（1986-1991）。
 * 中国曾在 1986-1991 年每年 4 月中旬至 9 月中旬实行夏令时，期间时钟拨快 1 小时。
 * 出生在此时段的档案，其记录的"钟表时间"应扣除 1 小时，再参与真太阳时与干支排算。
 * 规则来源：国务院 1986 年决定，全国统一夏令时（北京时间 +1h）。
 */
export interface ChinaDstRange {
  start: { month: number; day: number; hour: number; minute: number };
  end: { month: number; day: number; hour: number; minute: number };
}

/** 各年份夏令时区间（当地时间，结束时刻含 = 2:00 时刻起结束） */
export const CHINA_DST_RANGES: Record<number, ChinaDstRange> = {
  1986: {
    start: { month: 5, day: 4, hour: 2, minute: 0 },
    end: { month: 9, day: 14, hour: 2, minute: 0 },
  },
  1987: {
    start: { month: 4, day: 12, hour: 2, minute: 0 },
    end: { month: 9, day: 13, hour: 2, minute: 0 },
  },
  1988: {
    start: { month: 4, day: 10, hour: 2, minute: 0 },
    end: { month: 9, day: 11, hour: 2, minute: 0 },
  },
  1989: {
    start: { month: 4, day: 16, hour: 2, minute: 0 },
    end: { month: 9, day: 17, hour: 2, minute: 0 },
  },
  1990: {
    start: { month: 4, day: 15, hour: 2, minute: 0 },
    end: { month: 9, day: 16, hour: 2, minute: 0 },
  },
  1991: {
    start: { month: 4, day: 14, hour: 2, minute: 0 },
    end: { month: 9, day: 15, hour: 2, minute: 0 },
  },
};

function toMinutes(m: number, d: number, h: number, mi: number): number {
  return m * 31 * 24 * 60 + d * 24 * 60 + h * 60 + mi;
}

/**
 * 判断给定"钟表读数"是否处于中国夏令时期间。
 * @param clockTime 钟表读数即 UTC 字段的 Date
 */
export function inChinaDst(clockTime: Date): boolean {
  const range = CHINA_DST_RANGES[clockTime.getUTCFullYear()];
  if (!range) return false;
  const t = toMinutes(
    clockTime.getUTCMonth() + 1,
    clockTime.getUTCDate(),
    clockTime.getUTCHours(),
    clockTime.getUTCMinutes(),
  );
  const s = toMinutes(range.start.month, range.start.day, range.start.hour, range.start.minute);
  const e = toMinutes(range.end.month, range.end.day, range.end.hour, range.end.minute);
  return t >= s && t < e;
}

export interface DstAdjustment {
  applied: boolean;
  /** 原始钟表读数 */
  original: string;
  /** 扣除 1 小时后的实际钟表读数 */
  adjusted: string;
  note: string;
}

/** 夏令时校正：处于期间内则扣 1 小时 */
export function applyChinaDst(clockTime: Date): { adjusted: Date; dst: DstAdjustment } {
  const applied = inChinaDst(clockTime);
  const original = `${clockTime.getUTCFullYear()}-${String(clockTime.getUTCMonth() + 1).padStart(2, '0')}-${String(clockTime.getUTCDate()).padStart(2, '0')} ${String(clockTime.getUTCHours()).padStart(2, '0')}:${String(clockTime.getUTCMinutes()).padStart(2, '0')}`;
  if (!applied) {
    return {
      adjusted: clockTime,
      dst: {
        applied: false,
        original,
        adjusted: original,
        note: '出生时间不在中国夏令时期间，无需校正。',
      },
    };
  }
  const adjusted = new Date(clockTime.getTime() - 3600_000);
  const adjStr = `${adjusted.getUTCFullYear()}-${String(adjusted.getUTCMonth() + 1).padStart(2, '0')}-${String(adjusted.getUTCDate()).padStart(2, '0')} ${String(adjusted.getUTCHours()).padStart(2, '0')}:${String(adjusted.getUTCMinutes()).padStart(2, '0')}`;
  return {
    adjusted,
    dst: {
      applied: true,
      original,
      adjusted: adjStr,
      note: `该出生时间处于中国夏令时（1986-1991）期间，已将钟表时间扣除 1 小时（${original} → ${adjStr}）后再行校正。`,
    },
  };
}
