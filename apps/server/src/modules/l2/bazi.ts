/**
 * L2 术数算力池 - 八字命理流派（V1）
 * 基于 lunar-javascript EightChar 排盘：四柱干支、纳音、五行、十神、藏干、
 * 旬空、胎元命宫、大运流年。
 */
import { Solar } from 'lunar-javascript';

const WUXING_GAN: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

export interface PillarItem {
  ganzhi: string;
  gan: string;
  zhi: string;
  wuxingGan: string;
  wuxingZhi: string;
  nayin: string;
  shishenGan: string;
  shishenZhi: string[];
  hideGan: string[];
  dishi: string;
}

export interface DaYunItem {
  index: number;
  ganzhi: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
}

export interface BaziResult {
  gender: string;
  pillars: { year: PillarItem; month: PillarItem; day: PillarItem; time: PillarItem };
  dayMaster: { gan: string; wuxing: string };
  /** 天干 + 地支主气五行计数 */
  wuxingCount: Record<string, number>;
  /** 日主旺衰倾向：偏旺/中和/偏弱 */
  strength: string;
  shishenStats: Array<{ name: string; count: number }>;
  xunKong: { xun: string; kong: string };
  taiYuan: string;
  mingGong: string;
  daYun: DaYunItem[];
  currentDaYun: DaYunItem | null;
  birthYear: number;
  /** 排盘流派标注（子时换日与起运口径） */
  sectNote: string;
}

function buildPillar(gan: string, zhi: string, ganZhi: string, wuxing: string, naYin: string, shishenGan: string, shishenZhi: string[], hideGan: string[], dishi: string): PillarItem {
  return {
    ganzhi: ganZhi,
    gan,
    zhi,
    wuxingGan: WUXING_GAN[gan] ?? '',
    wuxingZhi: WUXING_GAN[hideGan[0] ?? zhi[0]] ?? '',
    nayin: naYin,
    shishenGan,
    shishenZhi,
    hideGan,
    dishi,
  };
}

export function buildBazi(clockTime: Date, gender: string): BaziResult {
  const solar = Solar.fromYmdHms(
    clockTime.getUTCFullYear(),
    clockTime.getUTCMonth() + 1,
    clockTime.getUTCDate(),
    clockTime.getUTCHours(),
    clockTime.getUTCMinutes(),
    clockTime.getUTCSeconds(),
  );
  const bz = solar.getLunar().getEightChar();
  // 流派统一：整子时换日（23:00 归次日，sect=2），与主流排盘软件一致
  bz.setSect(2);

  const pillars = {
    year: buildPillar(bz.getYearGan(), bz.getYearZhi(), bz.getYear(), bz.getYearWuXing(), bz.getYearNaYin(), bz.getYearShiShenGan(), bz.getYearShiShenZhi(), bz.getYearHideGan(), bz.getYearDiShi()),
    month: buildPillar(bz.getMonthGan(), bz.getMonthZhi(), bz.getMonth(), bz.getMonthWuXing(), bz.getMonthNaYin(), bz.getMonthShiShenGan(), bz.getMonthShiShenZhi(), bz.getMonthHideGan(), bz.getMonthDiShi()),
    day: buildPillar(bz.getDayGan(), bz.getDayZhi(), bz.getDay(), bz.getDayWuXing(), bz.getDayNaYin(), bz.getDayShiShenGan(), bz.getDayShiShenZhi(), bz.getDayHideGan(), bz.getDayDiShi()),
    time: buildPillar(bz.getTimeGan(), bz.getTimeZhi(), bz.getTime(), bz.getTimeWuXing(), bz.getTimeNaYin(), bz.getTimeShiShenGan(), bz.getTimeShiShenZhi(), bz.getTimeHideGan(), bz.getTimeDiShi()),
  };

  // 五行计数：天干 + 地支主气（藏干首位）
  const wuxingCount: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of [pillars.year, pillars.month, pillars.day, pillars.time]) {
    wuxingCount[p.wuxingGan] = (wuxingCount[p.wuxingGan] ?? 0) + 1;
    wuxingCount[p.wuxingZhi] = (wuxingCount[p.wuxingZhi] ?? 0) + 1;
  }

  const dayWuXing = WUXING_GAN[pillars.day.gan] ?? '';
  // 同类（生我+我）= 印星 + 比劫；异类 = 官杀财食伤
  const same = (wuxingCount[dayWuXing] ?? 0) + (wuxingCount[genShengWo(dayWuXing)] ?? 0);
  const strength = same >= 5 ? '偏旺' : same <= 2 ? '偏弱' : '中和';

  // 十神统计（天干十神 + 地支十神展开）
  const shishenCount: Record<string, number> = {};
  const addShishen = (names: string[]) => {
    for (const n of names) shishenCount[n] = (shishenCount[n] ?? 0) + 1;
  };
  addShishen([pillars.year.shishenGan, pillars.month.shishenGan, pillars.time.shishenGan, '日主']);
  addShishen(pillars.year.shishenZhi);
  addShishen(pillars.month.shishenZhi);
  addShishen(pillars.day.shishenZhi);
  addShishen(pillars.time.shishenZhi);
  const shishenStats = Object.entries(shishenCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const birthYear = clockTime.getUTCFullYear();

  // 大运（前 5 步）：起运按分钟精度（3 天折 1 年，sect=2），与排盘流派一致
  const yun = bz.getYun(gender === 'female' ? 0 : 1, 2);
  const rawDaYun = yun.getDaYun(6);
  const daYun: DaYunItem[] = rawDaYun
    .slice(1, 6)
    .filter((d) => d.getGanZhi())
    .map((d) => ({
      index: d.getIndex(),
      ganzhi: d.getGanZhi(),
      startAge: d.getStartAge(),
      endAge: d.getEndAge(),
      startYear: d.getStartYear(),
      endYear: d.getEndYear(),
    }));

  // 当前所处大运（以 2026 为当前年）
  const currentYear = 2026;
  const currentDaYun = daYun.find((d) => currentYear >= d.startYear && currentYear <= d.endYear) ?? null;

  return {
    gender,
    pillars,
    dayMaster: { gan: pillars.day.gan, wuxing: dayWuXing },
    wuxingCount,
    strength,
    shishenStats,
    xunKong: { xun: bz.getDayXun(), kong: bz.getDayXunKong() },
    taiYuan: bz.getTaiYuan(),
    mingGong: bz.getMingGong(),
    daYun,
    currentDaYun,
    birthYear,
    sectNote: '流派口径：子时整时换日（23:00 起归次日，不分早晚子）；起运按分钟精度（3 天折 1 年）。如需古法夜子时口径，可在后续版本开放流派切换。',
  };
}

/** 五行相生：找生我者（如金生水，故金生水 -> genShengWo('水')='金'） */
function genShengWo(me: string): string {
  const map: Record<string, string> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
  return map[me] ?? '';
}
