/**
 * L5/L7/L8 回归校验用例（确定性输出断言）。
 * 运行：npm run verify:l3 -w @fate/server
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

const checks: Array<[string, boolean]> = [
  ['L5 识别到卡点', l5.karmaPatterns.length >= 2],
  ['L5 伤官过旺命中主卡点', l5.karmaPatterns.some((p) => p.name === '求认可与自我证明')],
  ['L5 缺木命中成长模式', l5.karmaPatterns.some((p) => p.name === '成长方向与破局')],
  ['L5 主卡点非空', l5.mainKnot.length > 0],
  ['L5 主卡点=求认可与自我证明', l5.mainKnot === '求认可与自我证明'],
  ['L5 化解路径 4 条', l5.resolutionPath.length === 4],
  ['L5 每项卡点成因非空', l5.karmaPatterns.every((p) => p.cause.length > 0 && p.manifestation.length > 0)],
  ['L5 祛魅提示存在', l5.note.includes('倾向')],
  ['L6 四条平行线', l6.lines.length === 4],
  ['L6 契合度 0-100', l6.lines.every((ln) => ln.fit >= 0 && ln.fit <= 100)],
  ['L6 转型线契合度最高100', l6.lines.find((ln) => ln.key === 'transform')?.fit === 100],
  ['L6 契合度序列61/61/85/100', l6.lines.map((ln) => ln.fit).join(',') === '61,61,85,100'],
  ['L6 分叉点2个且年份递增', l6.branchPoints.length === 2 && l6.branchPoints[0].year < l6.branchPoints[1].year],
  ['L6 分叉点年份2035/2045', l6.branchPoints[0]?.year === 2035 && l6.branchPoints[1]?.year === 2045],
  ['L6 分叉点年龄34/44', l6.branchPoints[0]?.age === 34 && l6.branchPoints[1]?.age === 44],
  ['L6 分叉点含行运背景', l6.branchPoints[0]?.context.includes('乙卯') && l6.branchPoints[1]?.context.includes('丙辰')],
  ['L6 说明含主卡点变量', l6.note.includes(l5.mainKnot)],
  ['L7 元规则 3 条', l7.metaRules.length === 3],
  ['L7 元规则含人为权重过半', l7.metaRules.some((m) => m.includes('人为权重过半'))],
  ['L7 冲突裁定存在', l7.conflictResolution.length >= 1],
  ['L7 裁定以日主为纲纳音为参', l7.conflictResolution[0]?.ruling.includes('日主') && l7.conflictResolution[0]?.ruling.includes('纳音')],
  ['L7 裁定依据元规则第2条', l7.conflictResolution[0]?.basis.includes('元规则第 2 条')],
  ['L7 综合结论 5 条', l7.synthesis.length === 5],
  ['L7 结论含50%人为权重', l7.synthesis.some((s) => s.includes('50%'))],
  ['L7 结论含主卡点', l7.synthesis.some((s) => s.includes(l5.mainKnot))],
  ['L7 内核声明含版本', l7.coreNote.includes('版本冻结')],
  ['L8 七级完整', l8.levels.length === 7],
  ['L8 每级 2 条', l8.levels.every((lv) => lv.items.length === 2)],
  ['L8 主卡点融入认知层', l8.levels[2].items[0].title.includes(l5.mainKnot)],
  ['L8 主卡点融入化解层', l8.levels[4].items[0].title.includes(l5.mainKnot)],
  ['L8 七级顺序由外到内', l8.levels.map((lv) => lv.name).join('>') === '环境布局>行为抉择>认知思维>习惯体系>因果化解>信息维度重构>心性破执'],
  ['L8 每项执行周期非空', l8.levels.every((lv) => lv.items.every((it) => it.execCycle.length > 0))],
  ['L8 含每日周期项', l8.levels.some((lv) => lv.items.some((it) => it.execCycle === '每日'))],
  ['L8 方案说明含由外到内', l8.note.includes('由外到内')],
  ['L9 三课齐全', l9.lifeLessons.length === 3],
  ['L9 第一课含主卡点', l9.lifeLessons[0].title.includes(l5.mainKnot)],
  ['L9 第二课借主导五行之势', l9.lifeLessons[1].title.includes('土')],
  ['L9 第三课含行运窗口', l9.lifeLessons[2].title.includes('窗口')],
  ['L9 人为空间过半声明', l9.essence.includes('50%')],
  ['L9 真言完整', l9.mantra === '命是地图，运是天气，路是自己走的。'],
  ['L9 合规声明不含预测', l9.finalNote.includes('不构成') && l9.finalNote.includes('预测')],
  ['L9 合规声明含专业/心理支持', l9.finalNote.includes('专业') && l9.finalNote.includes('心理')],
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
console.log('全部断言通过');
