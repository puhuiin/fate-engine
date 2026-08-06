/**
 * L1 真太阳时回归校验用例（PRD「测试用例参照」）。
 * 运行：npm run verify:l1 -w @fate/server
 */
import { runL1 } from '../src/modules/l1/l1.js';

const cases = [
  {
    name: '2002-11-29 20:40 北京',
    input: { solarDate: '2002-11-29', solarTime: '20:40', cityName: '北京', timezoneOffset: 8 },
    expect: { trueSolarHours: 20.604, shichen: '戌时', dayGanZhi: '辛丑' },
    tol: 0.02,
  },
  {
    name: '2026-08-03 20:40 北京',
    input: { solarDate: '2026-08-03', solarTime: '20:40', cityName: '北京', timezoneOffset: 8 },
    expect: { trueSolarHours: 20.329, shichen: '戌时', dayGanZhi: '己酉' },
    tol: 0.02,
  },
  {
    name: '2002-11-29 20:40 乌鲁木齐(经度差大→酉时)',
    input: { solarDate: '2002-11-29', solarTime: '20:40', cityName: '乌鲁木齐', timezoneOffset: 8 },
    expect: { trueSolarHours: 18.685, shichen: '酉时', dayGanZhi: '辛丑' },
    tol: 0.02,
  },
  {
    name: '2002-11-29 20:40 上海(东经121.5→真太阳时提前)',
    input: { solarDate: '2002-11-29', solarTime: '20:40', cityName: '上海', timezoneOffset: 8 },
    expect: { trueSolarHours: 20.942, shichen: '戌时', dayGanZhi: '辛丑' },
    tol: 0.02,
  },
  {
    name: '2002-11-29 23:30 北京(晚子时不换日柱)',
    input: { solarDate: '2002-11-29', solarTime: '23:30', cityName: '北京', timezoneOffset: 8 },
    expect: { trueSolarHours: 23.437, shichen: '子时', dayGanZhi: '辛丑' },
    tol: 0.02,
  },
  {
    name: '2002-11-30 00:30 北京(0点后换日柱)',
    input: { solarDate: '2002-11-30', solarTime: '00:30', cityName: '北京', timezoneOffset: 8 },
    expect: { trueSolarHours: 0.437, shichen: '子时', dayGanZhi: '壬寅' },
    tol: 0.02,
  },
  {
    name: '2002-03-15 20:40 北京(春季方程时差提前)',
    input: { solarDate: '2002-03-15', solarTime: '20:40', cityName: '北京', timezoneOffset: 8 },
    expect: { trueSolarHours: 20.266, shichen: '戌时', dayGanZhi: '壬午' },
    tol: 0.02,
  },
  {
    name: '2002-01-01 00:00 北京(凌晨真太阳时回拨前夜)',
    input: { solarDate: '2002-01-01', solarTime: '00:00', cityName: '北京', timezoneOffset: 8 },
    expect: { trueSolarHours: 23.7, shichen: '子时', dayGanZhi: '戊辰' },
    tol: 0.02,
  },
];

let failed = 0;
for (const c of cases) {
  const r = runL1({ timePrecision: 'minute', sourceReliability: 'certificate', ...c.input });
  const diff = Math.abs(r.timeCorrection.trueSolarHours - c.expect.trueSolarHours);
  const ok =
    diff <= c.tol &&
    r.shichen.name === c.expect.shichen &&
    r.lunar.dayGanZhi === c.expect.dayGanZhi;
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.name} → 真太阳时 ${r.timeCorrection.trueSolarHours.toFixed(2)}（期望 ${c.expect.trueSolarHours}±${c.tol}）${r.shichen.name} ${r.lunar.dayGanZhi}日`,
  );
}

// 边界用例：闰年 2/29（历法真实性）与夏令时实施期（1986-1991 时钟回拨 1 小时）
const leap = runL1({
  solarDate: '2004-02-29',
  solarTime: '12:00',
  cityName: '北京',
  timezoneOffset: 8,
  timePrecision: 'minute',
  sourceReliability: 'certificate',
});
const leapOk =
  Math.abs(leap.timeCorrection.trueSolarHours - 11.543) <= 0.02 && leap.lunar.dayGanZhi === '戊寅';
if (!leapOk) failed++;
console.log(
  `${leapOk ? 'PASS' : 'FAIL'}  闰年 2004-02-29 12:00 北京 → 真太阳时 ${leap.timeCorrection.trueSolarHours.toFixed(2)} 戊寅日`,
);

const dst = runL1({
  solarDate: '1987-05-01',
  solarTime: '12:00',
  cityName: '北京',
  timezoneOffset: 8,
  timePrecision: 'minute',
  sourceReliability: 'certificate',
});
const dstOk = dst.dstAdjustment.applied && dst.dstAdjustment.adjusted === '1987-05-01 11:00';
if (!dstOk) failed++;
console.log(
  `${dstOk ? 'PASS' : 'FAIL'}  夏令时 1987-05-01 12:00 北京 → 校正 ${dst.dstAdjustment.original} → ${dst.dstAdjustment.adjusted}`,
);

if (failed > 0) {
  console.error(`${failed} 个用例失败`);
  process.exit(1);
}
console.log('全部用例通过');
