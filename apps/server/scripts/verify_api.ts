/**
 * 接口层全链路回归校验（内存 SQLite + fastify inject，无网络依赖）。
 * 覆盖：认证 / 档案 CRUD / 测算 / 付费解锁 / 改运打卡 / 级联删除 / 越权防护。
 * 运行：npm run verify:api -w @fate/server（全量 npm run verify 亦包含本脚本）
 */
import { createDb } from '../src/db/client.js';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

const db = createDb(':memory:');
const app: FastifyInstance = buildApp(db, { logger: false });

interface Resp {
  status: number;
  json: {
    code: number;
    msg: string;
    data: Record<string, any> | null;
  };
}

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  opts: { body?: unknown; token?: string } = {},
): Promise<Resp> {
  const res = await app.inject({
    method,
    url,
    payload: opts.body,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
  });
  return { status: res.statusCode, json: res.json() as Resp['json'] };
}

let failed = 0;
let passed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

/** 直接查库断言（级联清理证据） */
function count(table: string, where: string, ...args: Array<string | number>): number {
  return Number(
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get(...args) as { c: number }).c,
  );
}

// ---------- 1. 未登录访问受保护接口 → 401 ----------
const anon = await call('GET', '/api/v1/archives');
check('未登录访问档案列表 401', anon.status === 401 && anon.json.code === 401);

// ---------- 2. 游客登录 A / B ----------
const ga = await call('POST', '/api/v1/auth/guest', { body: { nickname: '测试甲' } });
const tokenA: string = ga.json.data?.token;
check('游客登录 A 返回 token', ga.status === 200 && typeof tokenA === 'string');

const gb = await call('POST', '/api/v1/auth/guest', { body: {} });
const tokenB: string = gb.json.data?.token;
check('游客登录 B 返回 token（越权方）', gb.status === 200 && typeof tokenB === 'string');

const guestEmptyNick = await call('POST', '/api/v1/auth/guest', { body: { nickname: '   ' } });
check('guest 空白昵称 400（trim+min1）', guestEmptyNick.status === 400 && guestEmptyNick.json.code === 400);

const tampered = tokenA.slice(0, -1) + (tokenA.endsWith('a') ? 'b' : 'a');
const tamperedRes = await call('GET', '/api/v1/archives', { token: tampered });
check('篡改 token 访问受保护接口 401', tamperedRes.status === 401 && tamperedRes.json.code === 401);

const halfToken = tokenA.split('.')[0];
const halfRes = await call('GET', '/api/v1/archives', { token: halfToken });
check('缺签名半截 token 401', halfRes.status === 401 && halfRes.json.code === 401);

const hugeToken = `${tokenA}${'x'.repeat(2048)}`;
const hugeRes = await call('GET', '/api/v1/archives', { token: hugeToken });
check('超长 token 拒绝 401', hugeRes.status === 401 && hugeRes.json.code === 401);

// ---------- 3. 档案创建 ----------
const arc1 = await call('POST', '/api/v1/archives', {
  token: tokenA,
  body: {
    gender: 'female',
    solarDate: '2002-11-29',
    solarTime: '20:40',
    cityName: '北京',
    timePrecision: 'minute',
    sourceReliability: 'certificate',
  },
});
const archive1 = arc1.json.data?.id as number;
check('A 创建档案1', arc1.status === 200 && Number.isInteger(archive1));

const arc2 = await call('POST', '/api/v1/archives', {
  token: tokenA,
  body: { gender: 'male', solarDate: '1990-05-15', solarTime: '08:00', cityName: '上海' },
});
const archive2 = arc2.json.data?.id as number;
check('A 创建档案2（供档案级联删除）', arc2.status === 200 && Number.isInteger(archive2));

// ---------- 4. 编辑档案 ----------
const patch = await call('PATCH', `/api/v1/archives/${archive1}`, {
  token: tokenA,
  body: { cityName: '南京', gender: 'male' },
});
check(
  'PATCH 编辑档案生效',
  patch.status === 200 && patch.json.data?.city_name === '南京' && patch.json.data?.gender === 'male',
);

const patchBad = await call('PATCH', `/api/v1/archives/${archive1}`, {
  token: tokenA,
  body: { solarDate: '2026-02-30' },
});
check('PATCH 非法日期 2026-02-30 拒绝', patchBad.status === 400 && patchBad.json.code === 400);

const patchEmpty = await call('PATCH', `/api/v1/archives/${archive1}`, { token: tokenA, body: {} });
check('PATCH 空字段 400', patchEmpty.status === 400);

const patchSingle = await call('PATCH', `/api/v1/archives/${archive1}`, {
  token: tokenA,
  body: { cityName: '广州' },
});
check(
  'PATCH 单字段不污染其余字段',
  patchSingle.status === 200 &&
    patchSingle.json.data?.gender === 'male' &&
    patchSingle.json.data?.solar_date === '2002-11-29' &&
    patchSingle.json.data?.solar_time === '20:40',
);

// ---------- 5. 城市检索 ----------
const loc = await call('GET', '/api/v1/locations/search?q=北');
check(
  '城市检索 q=北 返回结果',
  loc.status === 200 && Array.isArray(loc.json.data) && (loc.json.data as unknown[]).length > 0,
);

// ---------- 6. 测算：未付费锁定 L4-L9 ----------
const calc = await call('POST', '/api/v1/calculate', {
  token: tokenA,
  body: { archiveId: archive1, calcType: 'standard' },
});
const record1 = calc.json.data?.recordId as number;

const badCalcType = await call('POST', '/api/v1/calculate', {
  token: tokenA,
  body: { archiveId: archive1, calcType: 'quantum-extra' },
});
check('非法 calcType 400', badCalcType.status === 400 && badCalcType.json.code === 400);
const locked = calc.json.data?.lockedLayers as number[];
check(
  '测算成功且 lockedLayers=[4..9]',
  calc.status === 200 &&
    Number.isInteger(record1) &&
    JSON.stringify(locked) === JSON.stringify([4, 5, 6, 7, 8, 9]),
);
check(
  '测算响应 report L4 为 locked',
  Array.isArray(calc.json.data?.report) &&
    (calc.json.data.report as Array<{ layer: number; status: string; data: unknown }>).find(
      (x) => x.layer === 4,
    )?.status === 'locked',
);

const rec = await call('GET', `/api/v1/records/${record1}`, { token: tokenA });
check('未付费读记录 L4 被遮罩为 null', rec.status === 200 && rec.json.data?.report?.l4 === null);
check('未付费读记录 L1 可见', rec.status === 200 && rec.json.data?.report?.l1 != null);

// ---------- 7. 付费门禁：未解锁时深度层数据不得泄漏 ----------
const plansLocked = await call('GET', `/api/v1/records/${record1}/plans`, { token: tokenA });
check(
  '未付费读改运方案返回 locked 且为空',
  plansLocked.status === 200 &&
    plansLocked.json.data?.locked === true &&
    plansLocked.json.data?.total === 0 &&
    (plansLocked.json.data?.plans as unknown[]).length === 0,
);

const risksLocked = await call('GET', `/api/v1/records/${record1}/risks`, { token: tokenA });
check(
  '未付费读风险项返回 locked 且为空',
  risksLocked.status === 200 &&
    risksLocked.json.data?.locked === true &&
    risksLocked.json.data?.total === 0,
);

const hiddenPlanId = (db.prepare('SELECT id FROM luck_plan WHERE record_id = ? LIMIT 1').get(record1) as
  | { id: number }
  | undefined)?.id;
const tickLocked = await call('PATCH', `/api/v1/plans/${hiddenPlanId}`, {
  token: tokenA,
  body: { status: 'done' },
});
check('未付费改方案打卡 403', tickLocked.status === 403 && tickLocked.json.code === 403);

// ---------- 8. 付费解锁流程 ----------
const ord1 = await call('POST', '/api/v1/orders', { token: tokenA, body: { recordId: record1 } });
const orderId = ord1.json.data?.order?.id as number;
const amount = ord1.json.data?.order?.amount_cents as number;
check('创建解锁订单 ¥99(9900)', ord1.status === 200 && amount === 9900 && Number.isInteger(orderId));
check('订单响应不含内部 user_id', ord1.json.data?.order?.user_id === undefined);

const ord2 = await call('POST', '/api/v1/orders', { token: tokenA, body: { recordId: record1 } });
check('重复下单返回同一 pending 订单', ord2.status === 200 && ord2.json.data?.order?.id === orderId);

const pay = await call('POST', `/api/v1/orders/${orderId}/pay`, {
  token: tokenA,
  body: { channel: 'mock' },
});
check('模拟支付成功解锁', pay.status === 200 && pay.json.data?.paidStatus === 1);

const payBadChannel = await call('POST', `/api/v1/orders/${orderId}/pay`, {
  token: tokenA,
  body: { channel: 'crypto' },
});
check('非法支付渠道 400（白名单校验）', payBadChannel.status === 400 && payBadChannel.json.code === 400);

const paidRec = await call('GET', `/api/v1/records/${record1}`, { token: tokenA });
check('付费后记录 L4 完整可见', paidRec.status === 200 && paidRec.json.data?.report?.l4 != null);
check('付费后记录 paidStatus=1', paidRec.json.data?.paidStatus === 1);
check('记录响应不含内部 user_id 字段', paidRec.json.data?.user_id === undefined && paidRec.json.data?.raw_json === undefined);
check('正常记录 dataError=false', paidRec.json.data?.dataError === false);

db.prepare("UPDATE calculate_record SET raw_json = '{broken' WHERE id = ?").run(record1);
const brokenRec = await call('GET', `/api/v1/records/${record1}`, { token: tokenA });
check(
  '损坏 raw_json 返回 dataError=true 且 report=null',
  brokenRec.status === 200 &&
    brokenRec.json.data?.dataError === true &&
    brokenRec.json.data?.report === null,
);
db.prepare('UPDATE calculate_record SET raw_json = NULL WHERE id = ?').run(record1);
const nullRec = await call('GET', `/api/v1/records/${record1}`, { token: tokenA });
check('无 raw_json 记录同样标记 dataError', nullRec.status === 200 && nullRec.json.data?.dataError === true);

const st = await call('GET', `/api/v1/orders/status/${record1}`, { token: tokenA });
check('订单状态接口已解锁且无锁定层', st.json.data?.paidStatus === 1 && (st.json.data?.lockedLayers as unknown[]).length === 0);

// ---------- 8b. 解锁后改运方案与风险项完整可见 ----------
const plans = await call('GET', `/api/v1/records/${record1}/plans`, { token: tokenA });
const totalPlans = plans.json.data?.total as number;
const planId = plans.json.data?.plans?.[0]?.id as number;
check(
  '解锁后七级改运方案 total>=7 且未锁定',
  plans.status === 200 && totalPlans >= 7 && plans.json.data?.locked === false,
);

const tick = await call('PATCH', `/api/v1/plans/${planId}`, {
  token: tokenA,
  body: { status: 'done' },
});
check(
  '解锁后打卡 done 生效',
  tick.status === 200 && tick.json.data?.status === 'done' && tick.json.data?.finished_at != null,
);

const noteTooLong = await call('PATCH', `/api/v1/plans/${planId}`, {
  token: tokenA,
  body: { note: 'x'.repeat(201) },
});
check('改运备注超长 400', noteTooLong.status === 400 && noteTooLong.json.code === 400);

const noteOk = await call('PATCH', `/api/v1/plans/${planId}`, {
  token: tokenA,
  body: { note: '一周内执行一次' },
});
check('改运备注正常写入', noteOk.status === 200 && (noteOk.json.data?.content as string).includes('一周内执行一次'));

const badStatus = await call('PATCH', `/api/v1/plans/${planId}`, {
  token: tokenA,
  body: { status: 'x' },
});
check('打卡非法 status 不更新且语义明确', badStatus.status === 200 && badStatus.json.msg === '未更新任何字段');

const planStatusBefore = (
  db.prepare('SELECT status FROM luck_plan WHERE id = ?').get(planId) as { status: string }
).status;
const mixedBad = await call('PATCH', `/api/v1/plans/${planId}`, {
  token: tokenA,
  body: { status: 'pending', note: 'y'.repeat(201) },
});
const planStatusAfter = (
  db.prepare('SELECT status FROM luck_plan WHERE id = ?').get(planId) as { status: string }
).status;
check(
  'status+超长备注同时提交 400 且状态未被写入（部分成功防护）',
  mixedBad.status === 400 && mixedBad.json.code === 400 && planStatusAfter === planStatusBefore,
);

const planContentBefore = (
  db.prepare('SELECT content FROM luck_plan WHERE id = ?').get(planId) as { content: string }
).content;
const blankNote = await call('PATCH', `/api/v1/plans/${planId}`, {
  token: tokenA,
  body: { note: '   ' },
});
const planContentAfter = (
  db.prepare('SELECT content FROM luck_plan WHERE id = ?').get(planId) as { content: string }
).content;
check(
  '空白备注不追加空行',
  blankNote.status === 200 && planContentAfter === planContentBefore,
);

const risks = await call('GET', `/api/v1/records/${record1}/risks`, { token: tokenA });
const riskLevels = (risks.json.data?.risks as Array<{ risk_level: number }> | undefined)?.map(
  (r) => r.risk_level,
);
check('解锁后风险项落库 total>=2', risks.status === 200 && (risks.json.data?.total as number) >= 2);
check(
  '风险项含 L6 时点风险(level 4)与 L5 结构风险(level 3)',
  riskLevels?.includes(4) === true && riskLevels?.includes(3) === true,
);
check(
  '风险项按风险等级降序',
  riskLevels?.join(',') === [...(riskLevels ?? [])].sort((a, b) => b - a).join(','),
);

// ---------- 9. 手机验证码闭环 ----------
db.prepare(
  "INSERT INTO sms_code (phone, code, expires_at, channel) VALUES ('13855550000', '123456', '2020-01-01 00:00:00', 'login')",
).run();
const smsClean = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13855550000', channel: 'login' },
});
check(
  '发送验证码时清理该手机号过期验证码',
  smsClean.status === 200 &&
    count('sms_code', "phone = '13855550000' AND expires_at <= datetime('now')") === 0,
);

const sms = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13812345678', channel: 'login' },
});
const devCode = sms.json.data?.devCode as string;
check('短信发送回显 devCode（开发态）', sms.status === 200 && /^\d{6}$/.test(devCode));

const smsDup = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13812345678', channel: 'login' },
});
check('10 分钟内重复发送 429', smsDup.status === 429 && smsDup.json.code === 429);

const ph = await call('POST', '/api/v1/auth/phone', {
  body: { phone: '13812345678', code: devCode, nickname: '手机甲' },
});
check(
  '验证码登录成功且手机号脱敏',
  ph.status === 200 && typeof ph.json.data?.token === 'string' && ph.json.data?.user?.phone_masked === '138****5678',
);
check('登录响应不含明文完整手机号', ph.json.data?.user?.phone === undefined);

const phBad = await call('POST', '/api/v1/auth/phone', {
  body: { phone: '13812345678', code: '000000' },
});
check('错误验证码 403', phBad.status === 403 && phBad.json.code === 403);

// ---------- 9b. 验证码暴力枚举防护：5 次错误后作废 ----------
const sms2 = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13900001111', channel: 'login' },
});
const code2 = sms2.json.data?.devCode as string;
let lockedAt = 0;
for (let i = 1; i <= 5; i++) {
  const bad = await call('POST', '/api/v1/auth/phone', {
    body: { phone: '13900001111', code: '000000' },
  });
  if (bad.status === 403) lockedAt = i;
}
check('连续 5 次错误验证码均被拒', lockedAt === 5);

const bruteHit = await call('POST', '/api/v1/auth/phone', {
  body: { phone: '13900001111', code: code2 },
});
check('锁定后即使正确验证码也 403', bruteHit.status === 403 && bruteHit.json.code === 403);

const sms3 = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13900001111', channel: 'login' },
});
const code3 = sms3.json.data?.devCode as string;
const relogin = await call('POST', '/api/v1/auth/phone', {
  body: { phone: '13900001111', code: code3 },
});
check('重新获取验证码后可正常登录', relogin.status === 200 && typeof relogin.json.data?.token === 'string');

// ---------- 10. 越权防护：B 访问 A 的资源 → 404 ----------
const crossArc = await call('GET', `/api/v1/archives/${archive1}`, { token: tokenB });
check('越权读他人档案 404', crossArc.status === 404);

const crossRec = await call('GET', `/api/v1/records/${record1}`, { token: tokenB });
check('越权读他人记录 404', crossRec.status === 404);

const crossSt = await call('GET', `/api/v1/orders/status/${record1}`, { token: tokenB });
check('越权查他人订单状态 404', crossSt.status === 404);

const crossPlans = await call('GET', `/api/v1/records/${record1}/plans`, { token: tokenB });
check('越权读他人改运方案 404', crossPlans.status === 404);

const crossRisks = await call('GET', `/api/v1/records/${record1}/risks`, { token: tokenB });
check('越权读他人风险项 404', crossRisks.status === 404);

const crossCalc = await call('POST', '/api/v1/calculate', {
  token: tokenB,
  body: { archiveId: archive1, calcType: 'standard' },
});
check('越权用他人档案测算 404', crossCalc.status === 404 && crossCalc.json.code === 404);

const crossDel = await call('DELETE', `/api/v1/records/${record1}`, { token: tokenB });
check('越权删他人记录 404', crossDel.status === 404);

const badId = await call('GET', `/api/v1/records/abc`, { token: tokenA });
check('非数字 id 返回 400 而非 500', badId.status === 400 && badId.json.code === 400);
const badId2 = await call('GET', `/api/v1/records/-5`, { token: tokenA });
check('负 id 返回 400', badId2.status === 400 && badId2.json.code === 400);
const badHex = await call('GET', '/api/v1/records/0x10', { token: tokenA });
check('十六进制 id 拒绝 400（parseId 严格十进制）', badHex.status === 400 && badHex.json.code === 400);
const badSci = await call('GET', '/api/v1/records/1e2', { token: tokenA });
check('科学计数法 id 拒绝 400（parseId 严格十进制）', badSci.status === 400 && badSci.json.code === 400);
const badPay = await call('POST', `/api/v1/orders/xyz/pay`, {
  token: tokenA,
  body: { channel: 'mock' },
});
check('订单支付非法 id 400', badPay.status === 400 && badPay.json.code === 400);

// ---------- 11. 记录删除级联清理 ----------
const rec2calc = await call('POST', '/api/v1/calculate', {
  token: tokenA,
  body: { archiveId: archive2 },
});
const record2 = rec2calc.json.data?.recordId as number;

const page = await call('GET', `/api/v1/records?page=1&pageSize=1`, { token: tokenA });
check(
  '分页接口返回 1 条且 total>=2',
  page.status === 200 &&
    (page.json.data?.list as unknown[]).length === 1 &&
    (page.json.data?.total as number) >= 2 &&
    page.json.data?.page === 1 &&
    page.json.data?.pageSize === 1,
);
const pageNoArg = await call('GET', `/api/v1/records`, { token: tokenA });
check(
  '不分页时保持数组语义兼容',
  pageNoArg.status === 200 && Array.isArray(pageNoArg.json.data) && (pageNoArg.json.data as unknown[]).length >= 2,
);
const pageClamp = await call('GET', '/api/v1/records?page=999&pageSize=9999', { token: tokenA });
check(
  'pageSize 超上限 clamp 到 50',
  pageClamp.status === 200 && pageClamp.json.data?.pageSize === 50,
);
const pageHuge = await call('GET', '/api/v1/records?page=1e999', { token: tokenA });
check(
  'page 非有限数不 500，降级为 1',
  pageHuge.status === 200 && pageHuge.json.data?.page === 1,
);
const pageBigInt = await call('GET', '/api/v1/records?page=99999999999999999999', { token: tokenA });
check(
  'page 超大有限数不 500，clamp 到 100000',
  pageBigInt.status === 200 && pageBigInt.json.data?.page === 100000,
);
const pageFloat = await call('GET', '/api/v1/records?pageSize=2.5', { token: tokenA });
check(
  'pageSize 小数不 500，floor 为整数',
  pageFloat.status === 200 && pageFloat.json.data?.pageSize === 2,
);
const listRec = (pageNoArg.json.data as Array<Record<string, unknown>>)[0];
check(
  '记录列表不含内部 user_id/raw_json 字段',
  listRec?.user_id === undefined && listRec?.raw_json === undefined,
);

const delRec = await call('DELETE', `/api/v1/records/${record1}`, { token: tokenA });
check('A 删除记录成功', delRec.status === 200 && delRec.json.data?.removed === true);
check(
  '记录删除后 luck_plan/order_pay 级联清空',
  count('luck_plan', 'record_id = ?', record1) === 0 &&
    count('order_pay', 'record_id = ?', record1) === 0 &&
    count('risk_item', 'record_id = ?', record1) === 0 &&
    count('calculate_record', 'id = ?', record1) === 0,
);

// ---------- 12. 档案删除级联清理 ----------
const delArc = await call('DELETE', `/api/v1/archives/${archive2}`, { token: tokenA });
check('档案删除成功且级联移除 1 条记录', delArc.status === 200 && delArc.json.data?.removedRecords === 1);
check(
  '档案删除后记录/方案/订单/风险项全清',
  count('calculate_record', 'id = ?', record2) === 0 &&
    count('luck_plan', 'record_id = ?', record2) === 0 &&
    count('risk_item', 'record_id = ?', record2) === 0,
);

const delArc1 = await call('DELETE', `/api/v1/archives/${archive1}`, { token: tokenA });
check('删除已无记录的档案 removedRecords=0', delArc1.status === 200 && delArc1.json.data?.removedRecords === 0);

// ---------- 13. 内核日志 ----------
const kl = await call('POST', '/api/v1/kernel/log', {
  token: tokenA,
  body: { version: 'V16', ruleName: 'verify_api', ruleDetail: '接口层回归校验' },
});
check('内核迭代日志写入', kl.status === 200 && kl.json.data?.version === 'V16');

const klq = await call('GET', '/api/v1/kernel/logs?version=V16', { token: tokenA });
check('按版本查询内核日志', klq.status === 200 && (klq.json.data as unknown[]).length === 1);

const klOver = await call('POST', '/api/v1/kernel/log', {
  token: tokenA,
  body: { version: 'V16', ruleName: 'x'.repeat(51), ruleDetail: '' },
});
check('kernel 超长 ruleName 拒绝 400', klOver.status === 400 && klOver.json.code === 400);

db.close();

if (failed > 0) {
  console.error(`${failed} 个接口断言失败`);
  process.exit(1);
}
console.log(`接口层全量校验通过（${passed} 项断言）`);
