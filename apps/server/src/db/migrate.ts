/** 数据库迁移检查脚本：npm run db:migrate */
import { createDb, DB_PATH } from './client.js';
import { appliedMigrationVersions, MIGRATIONS } from './migrations.js';

const db = createDb();
console.log(`数据库就绪：${DB_PATH}`);
const tables = (
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{
    name: string;
  }>
).map((r) => r.name);
console.log('表清单：', tables.join(', '));
const applied = appliedMigrationVersions(db);
const latest = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
console.log(
  `迁移状态：已应用 ${applied.join(', ') || '（无）'}，最新版本 v${latest}`,
  applied.includes(latest) ? '（已是最新）' : '（有未应用迁移）',
);
db.close();
