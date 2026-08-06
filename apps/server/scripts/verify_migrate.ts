/**
 * 迁移机制专项回归：新库全量应用 + 旧库增量升级 + 幂等重跑。
 * 运行：npm run verify:migrate -w @fate/server
 */
import { createDb } from '../src/db/client.js';
import { appliedMigrationVersions, runMigrations, MIGRATIONS } from '../src/db/migrations.js';

let failed = 0;
let passed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

// 1. 新库：createDb 后全部迁移已应用，schema_migrations 记录齐全
const db = createDb(':memory:');
const versions = appliedMigrationVersions(db);
const latest = MIGRATIONS[MIGRATIONS.length - 1].version;
check(
  `新库应用全部迁移（v1..v${latest}）`,
  versions.length === MIGRATIONS.length &&
    versions.every((v, i) => v === i + 1) &&
    versions.includes(latest),
);

// 2. 迁移幂等：再次运行不重复应用、不报错
const reApplied = runMigrations(db);
check('重复执行迁移为空操作', reApplied.length === 0);
check(
  '迁移版本唯一无重复',
  new Set(appliedMigrationVersions(db)).size === appliedMigrationVersions(db).length,
);

// 3. 补列结果正确：全部迁移新增列均实际存在（防 schema 漂移）
const tableCols = (t: string): Set<string> =>
  new Set(
    (db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name),
  );
const archiveCols = tableCols('user_birth_archive');
check(
  'user_birth_archive 含 time_precision/source_reliability',
  archiveCols.has('time_precision') && archiveCols.has('source_reliability'),
);
const planCols = tableCols('luck_plan');
check('luck_plan 含 status/finished_at', planCols.has('status') && planCols.has('finished_at'));
const payCols = tableCols('order_pay');
check('order_pay 含 record_id 外键列', payCols.has('record_id'));
const smsCols = tableCols('sms_code');
check('sms_code 含 fail_count 列', smsCols.has('fail_count'));

// 3b. 迁移新增列可直接参与业务读写（默认值生效）
const uid = Number(db.prepare(`INSERT INTO sys_user (nickname) VALUES ('mig')`).run().lastInsertRowid);
const aid = Number(
  db.prepare(`INSERT INTO user_birth_archive (user_id, solar_date) VALUES (?, '2000-01-01')`).run(uid)
    .lastInsertRowid,
);
const rid = Number(
  db.prepare(`INSERT INTO calculate_record (archive_id, user_id) VALUES (?, ?)`).run(aid, uid)
    .lastInsertRowid,
);
db.prepare(
  `INSERT INTO luck_plan (record_id, level, title, content, exec_cycle) VALUES (?, 1, 't', 'c', 'daily')`,
).run(rid);
const planRow = db.prepare(
  `SELECT status, finished_at FROM luck_plan WHERE record_id = ?`,
).get(rid) as { status: string; finished_at: string | null };
check(
  'luck_plan 新列默认值生效（status=pending, finished_at=NULL）',
  planRow.status === 'pending' && planRow.finished_at === null,
);
db.prepare(
  `INSERT INTO order_pay (user_id, order_no, amount_cents, entitlement_status) VALUES (?, 'ORD-CHK', 100, 'pending')`,
).run(uid);
const payRow = db.prepare(
  `SELECT record_id FROM order_pay WHERE order_no = 'ORD-CHK'`,
).get() as { record_id: number | null };
check('order_pay record_id 新增列默认为 NULL', payRow.record_id === null);
db.prepare(
  `INSERT INTO sms_code (phone, code, expires_at) VALUES ('19000000000', '1234', '2030-01-01 00:00:00')`,
).run();
const smsRow = db.prepare(
  `SELECT fail_count FROM sms_code WHERE phone = '19000000000'`,
).get() as { fail_count: number };
check('sms_code fail_count 新列默认值生效（=0）', smsRow.fail_count === 0);

// 4. 旧库升级：模拟缺迁移记录的库，删除部分记录后应补齐
const legacy = createDb(':memory:');
legacy.prepare('DELETE FROM schema_migrations WHERE version > 2').run();
const partial = runMigrations(legacy);
check('旧库缺失迁移可补应用', partial.includes(latest) && partial.length === MIGRATIONS.length - 2);

db.close();
legacy.close();

console.log(`\n迁移回归：${passed} PASS / ${failed} FAIL`);
if (failed > 0) process.exit(1);
