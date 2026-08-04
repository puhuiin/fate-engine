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

const GAN_INDEX: Record<string, number> = {
  甲: 0, 乙: 1, 丙: 2, 丁: 3, 戊: 4,
  己: 5, 庚: 6, 辛: 7, 壬: 8, 癸: 9,
};

const ZHI_INDEX: Record<string, number> = {
  子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5,
  午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11,
};

/**
 * 干支组合在六十甲子中的序号（0=甲子）。
 * 解同余：n ≡ ganIndex (mod 10)，n ≡ zhiIndex (mod 12)，对合法组合恒有唯一解。
 */
function ganZhiIndex(gan: string, zhi: string): number {
  const g = GAN_INDEX[gan] ?? 0;
  const z = ZHI_INDEX[zhi] ?? 0;
  if ((z - g) % 2 !== 0) return 0; // 非法组合防御
  const k = (((5 * ((z - g) / 2)) % 6) + 6) % 6; // 5k ≡ (z-g)/2 (mod 6)，5 为 5 的模逆
  return g + 10 * k;
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
    dayInGanZhiIndex: ganZhiIndex(lunar.getDayGan(), lunar.getDayZhi()),
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
