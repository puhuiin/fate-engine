/**
 * L1 输入清洗校正层（V2 迭代成果）
 * 功能：公历/农历互转、真太阳时精确计算、时区/经纬度校准、
 *       时辰判定、误差评级、输入标准化。
 */
import { computeTrueSolarTime, shichenOfHour, type TrueSolarResult } from './time.js';
import { computeLunar, isJieQiBoundaryDay, type LunarL1Result } from './lunar.js';
import { findCity } from './location.js';
import {
  rateInput,
  type ErrorGrade,
  type SourceReliability,
  type TimePrecision,
} from './rating.js';
import { applyChinaDst, type DstAdjustment } from './dst.js';
import { isRealDate, isRealTime } from '../../schema.js';

export { type City } from './location.js';
export { searchCities } from './location.js';
export { type TrueSolarResult, shichenOfHour } from './time.js';
export { type ErrorGrade, type TimePrecision, type SourceReliability } from './rating.js';

export interface L1Input {
  /** 公历日期 YYYY-MM-DD */
  solarDate: string;
  /** 钟表时间 HH:mm 或 HH:mm:ss；时间精度为 day/fuzzy 时可省略 */
  solarTime?: string;
  timePrecision: TimePrecision;
  sourceReliability: SourceReliability;
  /** 出生城市（将自动解析经纬度） */
  cityName?: string;
  /** 手动经纬度（未提供 cityName 时使用） */
  longitude?: number;
  latitude?: number;
  /** 时区偏移小时，默认 8（东八区） */
  timezoneOffset?: number;
}

export interface L1Output {
  normalized: {
    solarDate: string;
    solarTime: string;
    timeKnown: boolean;
    timePrecision: TimePrecision;
    sourceReliability: SourceReliability;
  };
  location: {
    cityName: string;
    province: string;
    longitude: number;
    latitude: number;
    timezoneOffset: number;
    resolvedFromCity: boolean;
  } | null;
  timeCorrection: TrueSolarResult;
  shichen: { name: string; branch: string };
  lunar: LunarL1Result;
  boundaryRisk: boolean;
  /** 中国夏令时（1986-1991）校正记录 */
  dstAdjustment: DstAdjustment;
  rating: {
    grade: ErrorGrade;
    confidence: number;
    message: string;
    suggest: string[];
  };
}

/** 将 YYYY-MM-DD + HH:mm[:ss] 解析为"钟表读数即 UTC 字段"的 Date；非法输入抛错 */
export function parseClockDate(dateStr: string, timeStr?: string): Date {
  if (!isRealDate(dateStr)) {
    throw new Error('出生日期不存在，应为有效公历日期（YYYY-MM-DD）');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 12;
  let mm = 0;
  let ss = 0;
  if (timeStr && timeStr.trim()) {
    const t = timeStr.trim();
    if (!isRealTime(t)) {
      throw new Error('出生时间不存在，小时 0-23、分钟/秒 0-59');
    }
    const parts = t.split(':').map(Number);
    hh = parts[0] ?? 12;
    mm = parts[1] ?? 0;
    ss = parts[2] ?? 0;
  }
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh, mm, ss));
}

export function runL1(input: L1Input): L1Output {
  const tz = input.timezoneOffset ?? 8;
  const timeKnown = Boolean(input.solarTime && input.solarTime.trim());

  // 1. 城市 / 经纬度解析
  let location: L1Output['location'] = null;
  if (input.cityName) {
    const city = findCity(input.cityName);
    if (city) {
      location = {
        cityName: city.name,
        province: city.province,
        longitude: city.longitude,
        latitude: city.latitude,
        timezoneOffset: city.timezoneOffset,
        resolvedFromCity: true,
      };
    }
  }
  if (!location && input.longitude != null && input.latitude != null) {
    location = {
      cityName: '自定义坐标',
      province: '',
      longitude: input.longitude,
      latitude: input.latitude,
      timezoneOffset: tz,
      resolvedFromCity: false,
    };
  }

  // 2. 真太阳时校正（时间未知时以正午 12:00 占位，仅作展示）
  const clock = parseClockDate(input.solarDate, input.solarTime);
  const lon = location ? location.longitude : 120; // 无经纬度时以中央经线近似
  // 2.1 夏令时校正（1986-1991）：期间钟表时间扣除 1 小时
  const { adjusted: clockAdj, dst } = applyChinaDst(clock);
  const timeCorrection = computeTrueSolarTime(clockAdj, tz, lon);

  // 3. 时辰
  const shichen = shichenOfHour(timeCorrection.trueSolarHours);

  // 4. 农历 / 干支 / 节气
  const lunar = computeLunar(timeCorrection.trueSolarClockTime);

  // 5. 边界风险（交节当日 / 跨日）
  const boundaryRisk =
    isJieQiBoundaryDay(timeCorrection.trueSolarClockTime) || timeCorrection.crossDay;

  // 6. 误差评级
  // 时间未知时引擎仅能按正午 12:00 占位推定，实际精度至多到日——
  // 强制以 day 级参与评级，避免 API 传入 timePrecision='minute' 但无 solarTime 时置信度虚高。
  const rating = rateInput({
    timePrecision: timeKnown ? input.timePrecision : 'day',
    sourceReliability: input.sourceReliability,
    hasCity: Boolean(location),
    nearBoundary: boundaryRisk,
  });

  return {
    normalized: {
      solarDate: input.solarDate,
      solarTime: timeKnown ? input.solarTime!.trim() : '（时间未知，按正午占位）',
      timeKnown,
      timePrecision: input.timePrecision,
      sourceReliability: input.sourceReliability,
    },
    location,
    timeCorrection,
    shichen,
    lunar,
    boundaryRisk,
    dstAdjustment: dst,
    rating,
  };
}
