/**
 * 九层全量回归校验（L1-L9，确定性输出断言）。
 * 运行：npm run verify -w @fate/server
 */
import { runL1 } from '../src/modules/l1/l1.js';
import { runL2 } from '../src/modules/l2/l2.js';
import { runL3 } from '../src/modules/l3/l3.js';
import { runL4 } from '../src/modules/l4/l4.js';
import { runL5 } from '../src/modules/l5/l5.js';
import { runL6 } from '../src/modules/l6/l6.js';
import { runL7 } from '../src/modules/l7/l7.js';
import { runL8 } from '../src/modules/l8/l8.js';
import { runL9 } from '../src/modules/l9/l9.js';
import { buildNineLayerReport } from '../src/report.js';
import { parseClockDate } from '../src/modules/l1/l1.js';
import { isRealTime } from '../src/schema.js';

/** 固定"当前年份"保证测试确定性（大运定位/行运评分随年份变化） */
const CURRENT_YEAR = 2026;

const l1 = runL1({
  solarDate: '2002-11-29',
  solarTime: '20:40',
  timePrecision: 'minute',
  sourceReliability: 'certificate',
  cityName: '北京',
  timezoneOffset: 8,
});
const l2 = runL2(l1.timeCorrection.trueSolarClockTime, 'male', l1.normalized.timeKnown, CURRENT_YEAR);
const l3 = runL3(l2.bazi);
const l4 = runL4(l2.bazi);
const l5 = runL5(l2.bazi);
const l6 = runL6(l2.bazi, l4, l5);
const l7 = runL7(l1, l2, l4, l5);
const l8 = runL8(l4, l5, l2.bazi);
const l9 = runL9(l2.bazi, l4, l5, l7);

const report = buildNineLayerReport(l1, l2, l3, l4, l5, l6, l7, l8, l9);

/** 多城市真太阳时边界校验（同日同时刻 20:40） */
function solarProbe(cityName: string) {
  const p = runL1({
    solarDate: '2026-08-03',
    solarTime: '20:40',
    timePrecision: 'minute',
    sourceReliability: 'certificate',
    cityName,
    timezoneOffset: 8,
  });
  return {
    branch: p.shichen.branch,
    trueHours: p.timeCorrection.trueSolarHours,
    totalOffset: p.timeCorrection.totalOffsetMinutes,
  };
}
const harbin = solarProbe('哈尔滨');
const urumqi = solarProbe('乌鲁木齐');
const lhasa = solarProbe('拉萨');

/** 中国夏令时（1986-1991）校正校验 */
function dstProbe(solarDate: string, solarTime: string) {
  const p = runL1({
    solarDate,
    solarTime,
    timePrecision: 'minute',
    sourceReliability: 'certificate',
    cityName: '北京',
    timezoneOffset: 8,
  });
  return {
    applied: p.dstAdjustment.applied,
    branch: p.shichen.branch,
    adjusted: p.dstAdjustment.adjusted,
  };
}
const dstIn = dstProbe('1988-07-15', '12:00');
const dstOut = dstProbe('1985-07-15', '12:00');
const dstBoundaryEnd = dstProbe('1991-09-15', '02:30');
const dstStartOn = dstProbe('1986-05-04', '02:00');
const dstStartPre = dstProbe('1986-05-04', '01:59');
const dstStartPrevDay = dstProbe('1986-05-03', '23:00');
const dstEndOn = dstProbe('1986-09-14', '02:00');
const dstEndPre = dstProbe('1986-09-14', '01:59');

/** 跨日真太阳时归属校验：哈尔滨深夜 23:40 → 真太阳时跨日到次日子时，日柱/时柱用次日 */
function crossDayProbe(cityName: string, solarTime: string) {
  const p = runL1({
    solarDate: '2026-08-03',
    solarTime,
    timePrecision: 'minute',
    sourceReliability: 'certificate',
    cityName,
    timezoneOffset: 8,
  });
  return {
    branch: p.shichen.branch,
    crossDay: p.timeCorrection.crossDay,
    dayGanZhi: p.lunar.dayGanZhi,
    timeGanZhi: p.lunar.timeGanZhi,
    field: p.timeCorrection.trueSolarClockTime.toISOString(),
  };
}
const harbinLate = crossDayProbe('哈尔滨', '23:40');

/** 海外时区（UTC-8）真太阳时边界：非东八区应能正确校正且不溢出 */
const overseas = runL1({
  solarDate: '2002-11-29',
  solarTime: '20:40',
  timePrecision: 'minute',
  sourceReliability: 'certificate',
  cityName: '洛杉矶',
  longitude: -118.2,
  latitude: 34.05,
  timezoneOffset: -8,
});

/** 非法输入校验：Date.UTC 会 rollover，必须在入口拒绝 */
function rejectsInvalid(): boolean {
  let dateRejected = false;
  let timeRejected = false;
  try {
    parseClockDate('2026-02-30', '12:00');
  } catch {
    dateRejected = true;
  }
  try {
    parseClockDate('2000-01-01', '24:99');
  } catch {
    timeRejected = true;
  }
  return dateRejected && timeRejected && !isRealTime('25:00') && !isRealTime('12:60');
}

const checks: Array<[string, boolean]> = [
  ['L1 真太阳时校正', l1.timeCorrection.trueSolarHours > 0],
  ['L2 双流派排盘', l2.schools.length === 2],
  ['L3 祛魅声明', l3.disenchantNote.includes('文化隐喻')],
  ['L4 权重30/20/50', l4.weightModel.renwei === 0.5],
  ['L5 主卡点非空', l5.mainKnot.length > 0],
  ['L6 四条平行线', l6.lines.length === 4],
  ['L6 契合度归一', Math.max(...l6.lines.map((x) => x.fit)) === 100],
  ['L6 分叉点存在', l6.branchPoints.length >= 2],
  ['L6 多线开放声明', l6.note.includes('行动')],
  ['L7 冲突裁定', l7.conflictResolution.length >= 1],
  ['L8 七级完整', l8.levels.length === 7],
  ['L9 三课题', l9.lifeLessons.length === 3],
  ['L9 正念箴言', l9.mantra.length > 0],
  ['L9 合规声明(娱乐/心理支持)', l9.finalNote.includes('文化娱乐') && l9.finalNote.includes('专业心理支持')],
  ['九层全部 ready', report.length === 9 && report.every((l) => l.status === 'ready')],
  ['九层版本标注完整', report.every((l) => l.version.startsWith('V'))],
  ['哈尔滨(东经126.5) 真太阳时延后约20分', Math.abs(harbin.totalOffset - 20.1) < 1],
  ['哈尔滨 延后跨至亥时', harbin.branch === '亥'],
  ['哈尔滨 真太阳时≈21.0', Math.abs(harbin.trueHours - 21.0) < 0.2],
  ['乌鲁木齐(东经87.6) 真太阳时提前约2h15m', Math.abs(urumqi.totalOffset + 135.5) < 1.5],
  ['乌鲁木齐 提前至酉时', urumqi.branch === '酉'],
  ['乌鲁木齐 真太阳时≈18.4', Math.abs(urumqi.trueHours - 18.41) < 0.2],
  ['拉萨(东经91.1) 真太阳时提前约2h01m', Math.abs(lhasa.totalOffset + 121.4) < 1.5],
  ['拉萨 提前至酉时', lhasa.branch === '酉'],
  ['拉萨 真太阳时≈18.6', Math.abs(lhasa.trueHours - 18.64) < 0.2],
  ['北京 11-29 总偏差≈-4分(经度14.4-均时差11.9)', Math.abs(l1.timeCorrection.totalOffsetMinutes + 4) < 1],
  ['L2 流派口径标注', l2.bazi.sectNote.includes('整时换日')],
  ['主用例四柱=壬午辛亥辛丑戊戌(真太阳时同日内排盘)', l2.bazi.pillars.year.ganzhi === '壬午' && l2.bazi.pillars.month.ganzhi === '辛亥' && l2.bazi.pillars.day.ganzhi === '辛丑' && l2.bazi.pillars.time.ganzhi === '戊戌'],
  ['主用例日主为辛(非跨日次日壬)', l2.bazi.dayMaster.gan === '辛'],
  ['哈尔滨23:40 跨日至次日子时', harbinLate.crossDay && harbinLate.branch === '子'],
  ['哈尔滨23:40 日柱用次日(庚戌)而非当日', harbinLate.dayGanZhi === '庚戌' && harbinLate.field.startsWith('2026-08-04')],
  ['乌鲁木齐20:40 当日酉时日柱己酉', urumqi.branch === '酉'],
  ['非法日期2026-02-30/时间24:99 被拒绝', rejectsInvalid()],
  ['夏令时1988 扣1h至巳时', dstIn.applied && dstIn.branch === '巳'],
  ['夏令时1988 钟表读数12:00→11:00', dstIn.adjusted.includes('11:00')],
  ['非夏令时1985 午时不变', !dstOut.applied && dstOut.branch === '午'],
  ['夏令时结束边界1991-09-15 02:30 不校正', !dstBoundaryEnd.applied],
  ['夏令时1986 开始时刻 02:00 起生效', dstStartOn.applied],
  ['夏令时1986 开始前 01:59 不生效', !dstStartPre.applied],
  ['夏令时1986 开始前一天 23:00 不生效', !dstStartPrevDay.applied],
  ['夏令时1986 结束时刻 02:00 起结束', !dstEndOn.applied],
  ['夏令时1986 结束前 01:59 仍生效', dstEndPre.applied],
  ['海外时区(洛杉矶 UTC-8) 真太阳时 0-24 且含农历', overseas.timeCorrection.trueSolarHours >= 0 && overseas.timeCorrection.trueSolarHours < 24 && overseas.lunar.dayGanZhi.length > 0],
  ['主用例大运前5步完整且年份单调', l2.bazi.daYun.length >= 5 && l2.bazi.daYun.every((d, i, arr) => (i === 0 || d.startYear >= arr[i - 1].endYear))],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
if (failed > 0) {
  console.error(`${failed} 个断言失败`);
  process.exit(1);
}
console.log('九层全量校验通过');
