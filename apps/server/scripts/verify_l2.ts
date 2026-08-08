/**
 * L2/L3/L4 回归校验用例（确定性输出断言）。
 * 运行：npm run verify:l2 -w @fate/server
 */
import { runL1 } from '../src/modules/l1/l1.js';
import { runL2 } from '../src/modules/l2/l2.js';
import { runL3 } from '../src/modules/l3/l3.js';
import { runL4 } from '../src/modules/l4/l4.js';

/** 固定"当前年份"保证测试确定性（大运定位随年份变化） */
const CURRENT_YEAR = 2026;

const l1 = runL1({
  solarDate: '2002-11-29',
  solarTime: '20:40',
  timePrecision: 'minute',
  sourceReliability: 'certificate',
  cityName: '北京',
  timezoneOffset: 8,
});
const l2 = runL2(
  l1.timeCorrection.trueSolarClockTime,
  'male',
  l1.normalized.timeKnown,
  CURRENT_YEAR,
);
const l2f = runL2(
  l1.timeCorrection.trueSolarClockTime,
  'female',
  l1.normalized.timeKnown,
  CURRENT_YEAR,
);
const l2o = runL2(
  l1.timeCorrection.trueSolarClockTime,
  'other',
  l1.normalized.timeKnown,
  CURRENT_YEAR,
);
const l3 = runL3(l2.bazi);
const l4 = runL4(l2.bazi);

const checks: Array<[string, boolean]> = [
  ['L2 五流派并行', l2.schools.length === 5],
  ['L2 日主辛/金', l2.bazi.dayMaster.gan === '辛' && l2.bazi.dayMaster.wuxing === '金'],
  [
    'L2 当前大运甲寅2025-2034',
    l2.bazi.currentDaYun?.ganzhi === '甲寅' && l2.bazi.currentDaYun.startYear === 2025,
  ],
  ['L2 男命顺排(首步壬子)', l2.bazi.daYun[0].ganzhi === '壬子'],
  ['L2 女命逆排(首步庚戌)', l2f.bazi.daYun[0].ganzhi === '庚戌'],
  ['L2 阴阳顺逆方向不同', l2.bazi.daYun[0].ganzhi !== l2f.bazi.daYun[0].ganzhi],
  ['L2 未知性别按男命处理', l2o.bazi.daYun[0].ganzhi === l2.bazi.daYun[0].ganzhi],
  ['L2 冲突溯源存在', l2.conflicts.length > 0],
  ['L2 八字补身宫/胎息', !!l2.bazi.shenGong && !!l2.bazi.taiXi],
  [
    'L2 神煞天乙贵人（辛→午）落年支',
    (() => {
      const g = l2.schools.find((s) => s.school === '神煞格局')?.data as {
        groups?: Array<{ stars: Array<{ name: string; pillar: string }> }>;
      };
      return !!g?.groups?.some((x) =>
        x.stars.some((st) => st.name === '天乙贵人' && st.pillar.includes('年')),
      );
    })(),
  ],
  [
    'L2 五运六气 壬午→木运太过',
    (() => {
      const w = l2.schools.find((s) => s.school === '五运六气')?.data as {
        zhongYun?: { name: string; phase: string };
      };
      return w?.zhongYun?.name === '木运' && w.zhongYun.phase === '太过';
    })(),
  ],
  [
    'L2 五运六气 午→少阴君火司天/阳明燥金在泉',
    (() => {
      const w = l2.schools.find((s) => s.school === '五运六气')?.data as {
        siTian?: { qi: string };
        zaiQuan?: { qi: string };
      };
      return w?.siTian?.qi === '少阴君火' && w?.zaiQuan?.qi === '阳明燥金';
    })(),
  ],
  [
    'L2 五运六气 客气三之气=司天/终之气=在泉',
    (() => {
      const w = l2.schools.find((s) => s.school === '五运六气')?.data as {
        keQi?: Array<{ step: string; qi: string }>;
      };
      return w?.keQi?.[2]?.qi === '少阴君火' && w?.keQi?.[5]?.qi === '阳明燥金';
    })(),
  ],
  [
    'L2 十神六亲五组',
    (() => {
      const q = l2.schools.find((s) => s.school === '十神六亲')?.data as {
        relatives?: unknown[];
      };
      return q?.relatives?.length === 5;
    })(),
  ],
  ['L3 五维人格', l3.personality.length === 5],
  ['L3 祛魅声明存在', l3.disenchantNote.includes('文化隐喻')],
  [
    'L3 人格维度 0-100 且末位宜人性>=60',
    l3.personality.every((p) => p.score >= 0 && p.score <= 100) && l3.personality[4].score >= 60,
  ],
  [
    'L4 权重30/20/50',
    l4.weightModel.xiantian === 0.3 &&
      l4.weightModel.liunian === 0.2 &&
      l4.weightModel.renwei === 0.5,
  ],
  ['L4 六维评分', l4.dimensions.length === 6],
  ['L4 事业总分68', l4.dimensions.find((d) => d.key === 'career')?.total === 68],
  ['L4 结论强调人为主导', l4.summary.includes('人为')],
];

// 排盘边界：晚子时（23:30）日柱不换、早子时（00:30）日柱切换
const lateL1 = runL1({
  solarDate: '2002-11-29',
  solarTime: '23:30',
  cityName: '北京',
  timezoneOffset: 8,
  timePrecision: 'minute',
  sourceReliability: 'certificate',
});
const late = runL2(
  lateL1.timeCorrection.trueSolarClockTime,
  'male',
  lateL1.normalized.timeKnown,
  CURRENT_YEAR,
);
const earlyL1 = runL1({
  solarDate: '2002-11-30',
  solarTime: '00:30',
  cityName: '北京',
  timezoneOffset: 8,
  timePrecision: 'minute',
  sourceReliability: 'certificate',
});
const early = runL2(
  earlyL1.timeCorrection.trueSolarClockTime,
  'male',
  earlyL1.normalized.timeKnown,
  CURRENT_YEAR,
);
checks.push(
  ['排盘边界 晚子时23:30 日柱不换(辛丑)', late.bazi.pillars.day.ganzhi === '辛丑'],
  ['排盘边界 早子时00:30 日柱切换(壬寅)', early.bazi.pillars.day.ganzhi === '壬寅'],
  [
    '排盘边界 晚/早子时均入子时柱(庚子)',
    late.bazi.pillars.time.ganzhi === '庚子' && early.bazi.pillars.time.ganzhi === '庚子',
  ],
);

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
if (failed > 0) {
  console.error(`${failed} / ${checks.length} 个断言失败`);
  process.exit(1);
}
console.log(`全部断言通过（${checks.length} 项）`);
