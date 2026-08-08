/**
 * 测算结果缓存契约校验（与 verify_all / verify_api 同为 tsx 冒烟脚本）。
 * 锁定 computeNineLayers 的记忆化行为，防止回归：
 *   - 相同输入必须命中缓存（返回同一引用），否则每次 POST 都重算，优化失效；
 *   - 不同输入（calcType / 出生日期）必须得到独立对象，防止陈旧缓存污染；
 *   - 缓存条目数应与不同输入数一致，不异常增长。
 * 运行：npm run verify:cache -w @fate/server
 */
import { computeNineLayers, calcCache, CALC_CACHE_MAX, type CalcInput } from '../src/routes/calculate.js';
import type { FastifyBaseLogger } from 'fastify';

// 计算路径仅在生产异常分支记日志，单测用 no-op 即可。
const noopLog = { error: () => {} } as unknown as FastifyBaseLogger;

const base: CalcInput = {
  solarDate: '2002-11-29',
  solarTime: '20:40',
  timePrecision: 'minute',
  sourceReliability: 'certificate',
  cityName: '北京',
  longitude: 116.4,
  latitude: 39.9,
  timezoneOffset: 8,
  gender: 'male',
};

// 四次调用：相同输入(×2) → 不同 calcType → 不同出生日期 → 再次相同输入
const r1 = computeNineLayers(base, 'standard', noopLog);
const r2 = computeNineLayers(base, 'standard', noopLog);
const r3 = computeNineLayers(base, 'quantum', noopLog);
const r4 = computeNineLayers({ ...base, solarDate: '2003-01-15' }, 'standard', noopLog);
const r5 = computeNineLayers(base, 'standard', noopLog);

const checks: Array<[string, boolean]> = [
  ['缓存命中：相同输入返回同一引用', r1 === r2],
  ['缓存命中（穿插不同输入后仍命中）', r1 === r5],
  ['键敏感：不同 calcType 返回新对象', r3 !== r1],
  ['键敏感：不同出生日期返回新对象', r4 !== r1],
  ['命中结果报告结构完整（9 层全 ready）', r1.report.length === 9 && r1.report.every((l) => l.status === 'ready')],
  ['quantum 与 standard 报告为不同引用', r3.report !== r1.report],
  ['缓存条目数=不同输入数（无异常增长）', calcCache.size === 3],
  ['缓存容量受上限约束', calcCache.size <= CALC_CACHE_MAX],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
if (failed > 0) {
  console.error(`${failed} / ${checks.length} 个断言失败`);
  process.exit(1);
}
console.log(`测算缓存校验通过（${checks.length} 项断言）`);
