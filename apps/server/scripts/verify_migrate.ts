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

// 3. 补列结果正确
const archiveCols = new Set(
  (db.prepare('PRAGMA table_info(user_birth_archive)').all() as Array<{ name: string }>).map(
    (c) => c.name,
  ),
);
check(
  'user_birth_archive 含 time_precision/source_reliability',
  archiveCols.has('time_precision') && archiveCols.has('source_reliability'),
);

// 4. 旧库升级：模拟缺迁移记录的库，删除部分记录后应补齐
const legacy = createDb(':memory:');
legacy.prepare('DELETE FROM schema_migrations WHERE version > 2').run();
const partial = runMigrations(legacy);
check('旧库缺失迁移可补应用', partial.includes(latest) && partial.length === MIGRATIONS.length - 2);

db.close();
legacy.close();

console.log(`\n迁移回归：${passed} PASS / ${failed} FAIL`);
if (failed > 0) process.exit(1);
