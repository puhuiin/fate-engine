/**
 * L1 时间校正：真太阳时（True Solar Time）计算。
 * 真太阳时 = 本地平太阳时 + 均时差(EoT)
 *   本地平太阳时 = UTC + 经度/15（小时）
 *   均时差（Spencer/NOAA 近似，精度 ±1 分钟内，对时辰判定足够）
 */

const DEG2RAD = Math.PI / 180;

/** 年积日（1-366） */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

/** 均时差（分钟）。N = 年积日 */
export function equationOfTimeMinutes(N: number): number {
  const B = (2 * Math.PI * (N - 81)) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

export interface TrueSolarResult {
  /** 输入钟表时间（本地） */
  clockTime: Date;
  /** UTC 时间 */
  utcTime: Date;
  /** 本地平太阳时（小时 0-24） */
  meanSolarHours: number;
  /** 均时差（分钟） */
  equationOfTimeMinutes: number;
  /** 真太阳时（小时 0-24） */
  trueSolarHours: number;
  /** 与钟表时间的偏差（分钟，正=太阳走得快） */
  offsetMinutes: number;
  /** 与钟表时间的总偏差（分钟）= 经度修正 + 时区 + 均时差（用于前端展示真实校正量） */
  totalOffsetMinutes: number;
  /** 真太阳时对应的假想钟表时间（用于后续干支/节气排算） */
  trueSolarClockTime: Date;
  /** 是否发生跨日（真太阳时越过 24 点/0 点，影响日柱归属） */
  crossDay: boolean;
}

/**
 * 由本地钟表时间 + 时区偏移 + 经度计算真太阳时。
 * @param clockTime 用户填写的本地钟表时间
 * @param timezoneOffsetHours 时区偏移（东八区 = 8）
 * @param longitude 出生地经度（东经为正）
 */
export function computeTrueSolarTime(
  clockTime: Date,
  timezoneOffsetHours: number,
  longitude: number,
): TrueSolarResult {
  const utcTime = new Date(clockTime.getTime() - timezoneOffsetHours * 3600_000);

  const N = dayOfYear(utcTime);
  const eot = equationOfTimeMinutes(N);

  // 真太阳时刻 = 真实 UTC 时刻 + 经度修正 + 均时差。
  // 该时刻自带正确日期（自动处理跨日：如哈尔滨深夜 23:40 会推到次日 0 点后），
  // 且其 UTC 字段小时即真太阳时的小时，符合"钟表读数即 UTC 字段"约定。
  const trueSolarInstant = utcTime.getTime() + (longitude / 15) * 3600_000 + eot * 60_000;
  const trueSolarDate = new Date(trueSolarInstant);
  const trueSolarHours = normalizeHours(
    trueSolarDate.getUTCHours() + trueSolarDate.getUTCMinutes() / 60 + trueSolarDate.getUTCSeconds() / 3600,
  );

  const utcHours =
    utcTime.getUTCHours() + utcTime.getUTCMinutes() / 60 + utcTime.getUTCSeconds() / 3600;
  const meanSolarHours = utcHours + longitude / 15;

  // 排盘用"真太阳时的钟表读数"：直接取真太阳时刻（日期与时刻均已校正）
  const trueSolarClockTime = trueSolarDate;

  const offsetMinutes = Math.round((trueSolarHours - meanSolarHours) * 60);
  const clockHours =
    clockTime.getUTCHours() + clockTime.getUTCMinutes() / 60 + clockTime.getUTCSeconds() / 3600;
  const totalOffsetMinutes = Math.round((trueSolarHours - clockHours) * 60);

  return {
    clockTime,
    utcTime,
    meanSolarHours,
    equationOfTimeMinutes: eot,
    trueSolarHours,
    offsetMinutes,
    totalOffsetMinutes,
    trueSolarClockTime,
    crossDay: trueSolarHours >= 23 || trueSolarHours < 1,
  };
}

/** 归一化到 [0,24) */
export function normalizeHours(h: number): number {
  return ((h % 24) + 24) % 24;
}

/** 真太阳时 → 十二时辰 */
export const SHICHEN: Array<{ name: string; branch: string; start: number; end: number }> = [
  { name: '子时', branch: '子', start: 23, end: 25 },
  { name: '丑时', branch: '丑', start: 1, end: 3 },
  { name: '寅时', branch: '寅', start: 3, end: 5 },
  { name: '卯时', branch: '卯', start: 5, end: 7 },
  { name: '辰时', branch: '辰', start: 7, end: 9 },
  { name: '巳时', branch: '巳', start: 9, end: 11 },
  { name: '午时', branch: '午', start: 11, end: 13 },
  { name: '未时', branch: '未', start: 13, end: 15 },
  { name: '申时', branch: '申', start: 15, end: 17 },
  { name: '酉时', branch: '酉', start: 17, end: 19 },
  { name: '戌时', branch: '戌', start: 19, end: 21 },
  { name: '亥时', branch: '亥', start: 21, end: 23 },
];

export function shichenOfHour(hour24: number): { name: string; branch: string } {
  const h = hour24 >= 23 ? 25 : hour24; // 23:00 后计入子时区间
  const found = SHICHEN.find((s) => h >= s.start && h < s.end);
  return found ?? { name: '子时', branch: '子' };
}
