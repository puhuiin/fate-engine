/**
 * 接口层全链路回归校验（内存 SQLite + fastify inject，无网络依赖）。
 * 覆盖：认证 / 档案 CRUD / 测算 / 付费解锁 / 改运打卡 / 级联删除 / 越权防护。
 * 运行：npm run verify:api -w @fate/server（全量 npm run verify 亦包含本脚本）
 */
import { createDb } from '../src/db/client.js';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

const db = createDb(':memory:');
const app: FastifyInstance = buildApp(db, { logger: false, rateLimit: false });

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
  opts: { body?: unknown; token?: string; remoteAddress?: string } = {},
): Promise<Resp> {
  const res = await app.inject({
    method,
    url,
    payload: opts.body,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    ...(opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : {}),
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

// 订单过期机制：人为改旧后再次下单应作废旧单并新建；对过期订单支付返回 410
db.prepare(`UPDATE order_pay SET created_at = datetime('now', '-2 hours') WHERE id = ?`).run(orderId);
const ord3 = await call('POST', '/api/v1/orders', { token: tokenA, body: { recordId: record1 } });
const orderId3 = ord3.json.data?.order?.id as number;
const expiredOld = db
  .prepare('SELECT entitlement_status FROM order_pay WHERE id = ?')
  .get(orderId) as { entitlement_status: string };
check(
  '订单过期后重新下单自动作废旧单并新建',
  ord3.status === 200 && orderId3 !== orderId && expiredOld.entitlement_status === 'expired',
);
const payExpired = await call('POST', `/api/v1/orders/${orderId}/pay`, {
  token: tokenA,
  body: { channel: 'mock' },
});
check('对过期订单支付返回 410', payExpired.status === 410 && payExpired.json.code === 410);
const pay = await call('POST', `/api/v1/orders/${orderId3}/pay`, {
  token: tokenA,
  body: { channel: 'mock' },
});
check('模拟支付成功解锁', pay.status === 200 && pay.json.data?.paidStatus === 1);

const uidA = ga.json.data?.user?.id as number;
const resid = db
  .prepare(
    `INSERT INTO order_pay (order_no, user_id, record_id, amount_cents, entitlement_status)
     VALUES ('RST1', ?, ?, 9900, 'pending')`,
  )
  .run(uidA, record1);
const residOrderId = Number(resid.lastInsertRowid);
const payResid = await call('POST', `/api/v1/orders/${residOrderId}/pay`, {
  token: tokenA,
  body: { channel: 'mock' },
});
check(
  '记录已解锁时残留 pending 订单支付收尾成功',
  payResid.status === 200 && payResid.json.data?.paidStatus === 1,
);
const residRow = db
  .prepare('SELECT entitlement_status FROM order_pay WHERE id = ?')
  .get(residOrderId) as { entitlement_status: string };
check('残留订单状态被收尾为 granted', residRow.entitlement_status === 'granted');
const payAgain = await call('POST', `/api/v1/orders/${orderId3}/pay`, {
  token: tokenA,
  body: { channel: 'mock' },
});
check('已支付订单重复支付返回已支付', payAgain.status === 200 && payAgain.json.data?.paidStatus === 1);

const payBadChannel = await call('POST', `/api/v1/orders/${orderId3}/pay`, {
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
const planStatusAfterBad = (
  db.prepare('SELECT status FROM luck_plan WHERE id = ?').get(planId) as { status: string }
).status;
check(
  '打卡非法 status 拒绝 400 且状态未被写入',
  badStatus.status === 400 && badStatus.json.code === 400 && planStatusAfterBad === 'done',
);

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

// ---------- 9a. 验证码 60 秒重发窗口：冷却后允许重发且旧码作废 ----------
db.prepare(
  "UPDATE sms_code SET created_at = datetime('now', '-120 seconds') WHERE phone = '13812345678' AND used = 0",
).run();
const smsRetry = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13812345678', channel: 'login' },
});
check(
  '60 秒冷却后允许重新发送验证码',
  smsRetry.status === 200 && typeof smsRetry.json.data?.devCode === 'string',
);
const unUsed = count('sms_code', "phone = '13812345678' AND used = 0");
check('重发后历史未用验证码作废（仅 1 个有效码）', unUsed === 1);

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

// ---------- 9c. 游客数据迁移：手机号登录时合并游客档案/测算记录 ----------
const gm = await call('POST', '/api/v1/auth/guest', { body: { nickname: '待合并游客' } });
const tokenM = gm.json.data?.token as string;
const arcM = await call('POST', '/api/v1/archives', {
  token: tokenM,
  body: { gender: 'male', solarDate: '1992-03-21', solarTime: '12:30', cityName: '广州' },
});
const archiveM = arcM.json.data?.id as number;
const calcM = await call('POST', '/api/v1/calculate', {
  token: tokenM,
  body: { archiveId: archiveM, calcType: 'standard' },
});
check('合并前游客独立测算成功', calcM.status === 200 && Number.isInteger(calcM.json.data?.recordId));

const smsM = await call('POST', '/api/v1/auth/sms/send', {
  body: { phone: '13766668888', channel: 'login' },
});
const codeM = smsM.json.data?.devCode as string;
const phM = await call('POST', '/api/v1/auth/phone', {
  body: { phone: '13766668888', code: codeM, mergeGuestToken: tokenM },
});
check(
  '登录并合并游客数据（档案/记录均转移）',
  phM.status === 200 &&
    Number(phM.json.data?.merged?.records) >= 1 &&
    Number(phM.json.data?.merged?.archives) >= 1,
);
const tokenMerged = phM.json.data?.token as string;
const listMergedArc = await call('GET', '/api/v1/archives', { token: tokenMerged });
check(
  '合并后手机号账号可见游客档案',
  listMergedArc.status === 200 &&
    (listMergedArc.json.data as Array<{ id: number }>).some((a) => a.id === archiveM),
);
const listMergedRec = await call('GET', '/api/v1/records', { token: tokenMerged });
check(
  '合并后手机号账号可见游客记录',
  listMergedRec.status === 200 &&
    (listMergedRec.json.data as Array<{ archive_id: number }>).some((r) => r.archive_id === archiveM),
);

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

// ---------- 14. 生产安全加固 ----------
// 14.1 全局速率限制：独立实例（max=3），前 3 次放行、第 4 次起 429，响应为统一 ApiResp
const rlDb = createDb(':memory:');
const rlApp: FastifyInstance = buildApp(rlDb, {
  logger: false,
  rateLimit: { max: 3, windowMs: 60 * 1000 },
});
const rlStatus: number[] = [];
for (let i = 0; i < 5; i++) {
  const r = await rlApp.inject({ method: 'GET', url: '/api/v1/locations/search?q=bei' });
  rlStatus.push(r.statusCode);
}
check(
  '全局限流：前 3 次放行、第 4 次起 429',
  rlStatus.slice(0, 3).every((s) => s === 200) && rlStatus[3] === 429 && rlStatus[4] === 429,
);
const rlHit = await rlApp.inject({ method: 'GET', url: '/api/v1/locations/search?q=bei' });
check(
  '限流响应为统一 ApiResp(code=429)',
  rlHit.statusCode === 429 && (rlHit.json() as { code: number }).code === 429,
);
rlDb.close();

// 14.2 认证接口限流：独立实例（默认开启限流），guest 连续调用第 21 次起 429
const authRlDb = createDb(':memory:');
const authRlApp: FastifyInstance = buildApp(authRlDb, { logger: false });
const authStatus: number[] = [];
for (let i = 0; i < 22; i++) {
  const r = await authRlApp.inject({ method: 'POST', url: '/api/v1/auth/guest', payload: {} });
  authStatus.push(r.statusCode);
}
check(
  '认证接口限流：前 20 次放行、第 21 次起 429',
  authStatus.slice(0, 20).every((s) => s === 200) &&
    authStatus[20] === 429 &&
    authStatus[21] === 429,
);
authRlDb.close();

// 14.3 CORS 白名单：拒绝陌生来源，放行白名单来源
const corsDb = createDb(':memory:');
const corsApp: FastifyInstance = buildApp(corsDb, {
  logger: false,
  rateLimit: false,
  corsOrigins: ['http://allowed.example'],
});
const evilCors = await corsApp.inject({
  method: 'GET',
  url: '/api/v1/locations/search?q=bei',
  headers: { origin: 'https://evil.example' },
});
const okCors = await corsApp.inject({
  method: 'GET',
  url: '/api/v1/locations/search?q=bei',
  headers: { origin: 'http://allowed.example' },
});
check(
  'CORS 白名单拒绝陌生来源（无 ACAO 头）',
  evilCors.headers['access-control-allow-origin'] === undefined,
);
check(
  'CORS 白名单放行允许来源',
  okCors.headers['access-control-allow-origin'] === 'http://allowed.example',
);
corsDb.close();

// 14.4 请求体上限：>64KB body 返回 413 统一响应
const bigBody = await call('POST', '/api/v1/auth/guest', {
  body: { nickname: 'x'.repeat(100 * 1024) },
});
check('超大请求体拒绝 413', bigBody.status === 413 && bigBody.json.code === 413);

// 14.5 requireAuth Bearer 严格校验：非 Bearer 前缀一律 401
const basicAuth = await app.inject({
  method: 'GET',
  url: '/api/v1/archives',
  headers: { authorization: 'Basic dXNlcjpwYXNz' },
});
check('Basic 头不带 Bearer 前缀 401', basicAuth.statusCode === 401 && basicAuth.json().code === 401);
const bareBearer = await app.inject({
  method: 'GET',
  url: '/api/v1/archives',
  headers: { authorization: 'Bearer   ' },
});
check('空 Bearer token 401', bareBearer.statusCode === 401 && bareBearer.json().code === 401);

// ---------- 15. trustProxy：反向代理后按真实客户端 IP 限流分桶 ----------
// 15.1 开启 trustProxy：X-Forwarded-For 决定分桶，不同真实 IP 桶互不影响
const tpDb = createDb(':memory:');
const tpApp: FastifyInstance = buildApp(tpDb, {
  logger: false,
  rateLimit: { max: 2, windowMs: 60 * 1000 },
  trustProxy: true,
});
const tpStatus: number[] = [];
for (let i = 0; i < 3; i++) {
  const r = await tpApp.inject({
    method: 'GET',
    url: '/api/v1/locations/search?q=bei',
    headers: { 'x-forwarded-for': '203.0.113.10' },
  });
  tpStatus.push(r.statusCode);
}
check(
  'trustProxy：同一真实 IP 前 2 次放行、第 3 次 429',
  tpStatus.slice(0, 2).every((s) => s === 200) && tpStatus[2] === 429,
);
const otherIp = await tpApp.inject({
  method: 'GET',
  url: '/api/v1/locations/search?q=bei',
  headers: { 'x-forwarded-for': '203.0.113.11' },
});
check('trustProxy：不同真实 IP 独立分桶放行', otherIp.statusCode === 200);
tpDb.close();

// 15.2 未开 trustProxy：XFF 被忽略，全部按直连地址同桶计数
const noTpDb = createDb(':memory:');
const noTpApp: FastifyInstance = buildApp(noTpDb, {
  logger: false,
  rateLimit: { max: 2, windowMs: 60 * 1000 },
});
const noTpStatus: number[] = [];
for (let i = 0; i < 3; i++) {
  const r = await noTpApp.inject({
    method: 'GET',
    url: '/api/v1/locations/search?q=bei',
    headers: { 'x-forwarded-for': `203.0.113.${30 + i}` },
  });
  noTpStatus.push(r.statusCode);
}
check(
  '未开 trustProxy：不同 XFF 仍同桶计数（第 3 次 429）',
  noTpStatus.slice(0, 2).every((s) => s === 200) && noTpStatus[2] === 429,
);
noTpDb.close();

// ---------- 16. 档案部分更新：未传字段不被默认值覆盖，null 可置空 ----------
const updArc = await call('POST', '/api/v1/archives', {
  token: tokenA,
  body: {
    gender: 'male',
    solarDate: '2001-05-20',
    solarTime: '08:30',
    timePrecision: 'fuzzy',
    sourceReliability: 'family',
  },
});
const updId = (updArc.json.data as { id: number }).id;
const updPatch = await call('PATCH', `/api/v1/archives/${updId}`, {
  token: tokenA,
  body: { note: '仅改备注' },
});
const updAfter = await call('GET', `/api/v1/archives/${updId}`, { token: tokenA });
const updData = updAfter.json.data as Record<string, unknown>;
check('PATCH 部分更新成功（仅改 note）', updPatch.status === 200 && updData.note === '仅改备注');
check('PATCH 未传字段不被覆盖（time_precision 保持 fuzzy）', updData.time_precision === 'fuzzy');
check('PATCH 未传字段不被覆盖（source_reliability 保持 family）', updData.source_reliability === 'family');
const updSolar = await call('GET', `/api/v1/archives/${updId}`, { token: tokenA });
check('PATCH 未传字段不被覆盖（solar_time 保持 08:30）', (updSolar.json.data as { solar_time: string }).solar_time === '08:30');

// null 显式置空时间字段
const nullPatch = await call('PATCH', `/api/v1/archives/${updId}`, {
  token: tokenA,
  body: { solarTime: null },
});
const nullAfter = await call('GET', `/api/v1/archives/${updId}`, { token: tokenA });
check(
  'PATCH null 置空时间字段',
  nullPatch.status === 200 && (nullAfter.json.data as { solar_time?: string | null }).solar_time === null,
);

// ---------- 17. 无时间档案：置信度强制降级，不虚高 ----------
// API 直接传 timePrecision='minute' 但不带 solarTime 时，引擎按正午 12:00 占位推定，
// 置信度必须按 day 级评级（不得给出分钟级的精确假象）。
const noTimeArc = await call('POST', '/api/v1/archives', {
  token: tokenA,
  body: {
    gender: 'male',
    solarDate: '2003-03-15',
    timePrecision: 'minute',
    sourceReliability: 'certificate',
  },
});
const noTimeArcId = (noTimeArc.json.data as { id: number }).id;
const noTimeCalc = await call('POST', '/api/v1/calculate', {
  token: tokenA,
  body: { archiveId: noTimeArcId },
});
const noTimeL1 = (
  (noTimeCalc.json.data?.report as Array<{ layer: number; data: unknown }> | null)?.find(
    (x) => x.layer === 1,
  )?.data ?? {}
) as Record<string, unknown>;
const noTimeNormalized = (noTimeL1.normalized ?? {}) as Record<string, unknown>;
const noTimeRating = (noTimeL1.rating ?? { confidence: 0 }) as { confidence: number };
check('无时间档案测算成功', noTimeCalc.status === 200);
check('无时间档案 timeKnown=false', noTimeNormalized.timeKnown === false);
check('无时间档案时间标注为占位', String(noTimeNormalized.solarTime).includes('时间未知'));
check(
  '无时间档案置信度按日级降级（<60，拒绝 100 分钟级假象）',
  typeof noTimeRating.confidence === 'number' && noTimeRating.confidence < 60,
);

// ---------- 11. 请求链路增强：X-Request-Id / 禁止缓存 / 未知接口 404 ----------
const reqIdProbe = await app.inject({ method: 'GET', url: '/api/health' });
check('响应回显 X-Request-Id 请求追踪头', typeof reqIdProbe.headers['x-request-id'] === 'string');
check(
  'API 响应禁止缓存（Cache-Control: no-store）',
  String(reqIdProbe.headers['cache-control']).toLowerCase().includes('no-store'),
);
const notFound = await call('GET', '/api/v1/no-such-route');
check('未知 API 路由统一 ApiResp 404', notFound.status === 404 && notFound.json.code === 404);
const idEcho = await app.inject({
  method: 'GET',
  url: '/api/health',
  headers: { 'x-request-id': 'trace-abc-123' },
});
check('客户端传入 X-Request-Id 被透传回显', idEcho.headers['x-request-id'] === 'trace-abc-123');

// ---------- 12. 统计看板 + 个人资料编辑 ----------
const stats = await call('GET', '/api/v1/stats/overview', { token: tokenA });
const statsD = stats.json.data as Record<string, number | string> | null;
check(
  '统计看板返回聚合指标（档案/记录/计划）',
  stats.status === 200 &&
    statsD !== null &&
    typeof statsD.archivesCount === 'number' &&
    typeof statsD.totalRecords === 'number' &&
    typeof statsD.totalPlans === 'number',
);
const nickRes = await call('PATCH', '/api/v1/auth/profile', {
  token: tokenA,
  body: { nickname: '新昵称甲' },
});
check('修改昵称成功并回显', nickRes.status === 200 && nickRes.json.data?.nickname === '新昵称甲');
const nickShort = await call('PATCH', '/api/v1/auth/profile', {
  token: tokenA,
  body: { nickname: '   ' },
});
check('空白昵称被拒绝 400', nickShort.status === 400 && nickShort.json.code === 400);
const meAfter = await call('GET', '/api/v1/auth/me', { token: tokenA });
check('修改昵称持久化（me 接口可见）', meAfter.json.data?.nickname === '新昵称甲');
const statsAnon = await call('GET', '/api/v1/stats/overview');
check('统计看板未登录 401', statsAnon.status === 401 && statsAnon.json.code === 401);

db.close();

if (failed > 0) {
  console.error(`${failed} 个接口断言失败`);
  process.exit(1);
}
console.log(`接口层全量校验通过（${passed} 项断言）`);
