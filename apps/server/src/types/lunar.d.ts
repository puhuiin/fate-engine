/** lunar-javascript 最小类型声明（仅声明本工程使用的 API） */
declare module 'lunar-javascript' {
  export class Solar {
    static fromYmdHms(
      y: number,
      m: number,
      d: number,
      h: number,
      min: number,
      s: number,
    ): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
  }

  export class Lunar {
    toString(): string;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getTimeInGanZhi(): string;
    getYearShengXiao(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getDayGan(): string;
    getDayZhi(): string;
    getMonthInChinese(): string;
    /** 当日节气名，无则空串 */
    getJieQi(): string;
    getPrevJieQi(): JieQi | null;
    getNextJieQi(): JieQi | null;
    getEightChar(): EightChar;
  }

  export interface JieQi {
    getName(): string;
    getSolar(): Solar;
  }

  export class EightChar {
    setSect(sect: number): void;
    getSect(): number;
    getYear(): string;
    getYearGan(): string;
    getYearZhi(): string;
    getYearHideGan(): string[];
    getYearWuXing(): string;
    getYearNaYin(): string;
    getYearShiShenGan(): string;
    getYearShiShenZhi(): string[];
    getYearDiShi(): string;
    getMonth(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getMonthHideGan(): string[];
    getMonthWuXing(): string;
    getMonthNaYin(): string;
    getMonthShiShenGan(): string;
    getMonthShiShenZhi(): string[];
    getMonthDiShi(): string;
    getDay(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getDayHideGan(): string[];
    getDayWuXing(): string;
    getDayNaYin(): string;
    getDayShiShenGan(): string;
    getDayShiShenZhi(): string[];
    getDayDiShi(): string;
    getDayXun(): string;
    getDayXunKong(): string;
    getTime(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
    getTimeHideGan(): string[];
    getTimeWuXing(): string;
    getTimeNaYin(): string;
    getTimeShiShenGan(): string;
    getTimeShiShenZhi(): string[];
    getTimeDiShi(): string;
    getTaiYuan(): string;
    getTaiXi(): string;
    getMingGong(): string;
    getShenGong(): string;
    getYun(gender: number, sect: number): Yun;
  }

  export class Yun {
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getStartHour(): number;
    isForward(): boolean;
    getDaYun(n: number): DaYun[];
  }

  export class DaYun {
    getGanZhi(): string;
    getStartAge(): number;
    getEndAge(): number;
    getStartYear(): number;
    getEndYear(): number;
    getIndex(): number;
    getLiuNian(n: number): LiuNian[];
  }

  export class LiuNian {
    getYear(): number;
    getAge(): number;
    getGanZhi(): string;
  }
}
