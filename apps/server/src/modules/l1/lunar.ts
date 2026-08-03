/**
 * L1 农历 / 节气 / 干支换算（lunar-javascript 封装）。
 * 注意：lunar-javascript 将入参视为"钟表时间"，因此调用方需传入真太阳时
 * 调整后的假想钟表时间（见 time.ts trueSolarClockTime）。
 */
import { Solar } from 'lunar-javascript';

export interface LunarL1Result {
  lunarDate: string;
  yearGanZhi: string; // 年柱
  monthGanZhi: string; // 月柱
  dayGanZhi: string; // 日柱
  timeGanZhi: string; // 时柱
  yearAnimal: string; // 生肖
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  dayInGanZhiIndex: number; // 0=甲子
  currentJieQi: string; // 当日节气（无则空）
  prevJieQi: { name: string; time: string } | null; // 前一个节气（节）
  nextJieQi: { name: string; time: string } | null; // 下一个节气（节）
  jieQiNote: string; // 交节归属说明
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatSolar(s: Solar): string {
  return `${s.getYear()}-${pad2(s.getMonth())}-${pad2(s.getDay())} ${pad2(s.getHour())}:${pad2(
    s.getMinute(),
  )}:${pad2(s.getSecond())}`;
}

/**
 * 以给定钟表时间计算农历 / 干支 / 节气归属。
 * @param clockTime 真太阳时调整后的假想钟表时间（约定：UTC 字段即钟表读数）
 */
export function computeLunar(clockTime: Date): LunarL1Result {
  const solar = Solar.fromYmdHms(
    clockTime.getUTCFullYear(),
    clockTime.getUTCMonth() + 1,
    clockTime.getUTCDate(),
    clockTime.getUTCHours(),
    clockTime.getUTCMinutes(),
    clockTime.getUTCSeconds(),
  );
  const lunar = solar.getLunar();

  const prev = lunar.getPrevJieQi();
  const next = lunar.getNextJieQi();

  const jieQi = lunar.getJieQi();
  const currentJieQi = jieQi ? jieQi : '';

  // 月柱判定：以"节"为界（立春/惊蛰/清明...）
  const prevJieQiObj = prev
    ? {
        name: prev.getName(),
        time: formatSolar(prev.getSolar()),
      }
    : null;
  const nextJieQiObj = next
    ? {
        name: next.getName(),
        time: formatSolar(next.getSolar()),
      }
    : null;

  const jieQiNote =
    prevJieQiObj && nextJieQiObj
      ? `生于「${prevJieQiObj.name}」之后、「${nextJieQiObj.name}」之前，月柱归属${lunar.getMonthInGanZhi()}月（以节为界）。`
      : '交节边界数据不全，月柱归属需人工复核。';

  return {
    lunarDate: lunar.toString(),
    yearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    timeGanZhi: lunar.getTimeInGanZhi(),
    yearAnimal: lunar.getYearShengXiao(),
    lunarYear: lunar.getYear(),
    lunarMonth: lunar.getMonth(),
    lunarDay: lunar.getDay(),
    isLeapMonth: lunar.getMonthInChinese().includes('闰'),
    dayInGanZhiIndex: 0,
    currentJieQi,
    prevJieQi: prevJieQiObj,
    nextJieQi: nextJieQiObj,
    jieQiNote,
  };
}

/** 该日是否恰为交节当日（用于误差标注） */
export function isJieQiBoundaryDay(clockTime: Date): boolean {
  const solar = Solar.fromYmdHms(
    clockTime.getUTCFullYear(),
    clockTime.getUTCMonth() + 1,
    clockTime.getUTCDate(),
    clockTime.getUTCHours(),
    clockTime.getUTCMinutes(),
    0,
  );
  return solar.getLunar().getJieQi() !== '';
}
