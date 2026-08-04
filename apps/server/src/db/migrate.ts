/** 数据库迁移脚本：npm run db:migrate */
import { createDb, DB_PATH } from './client.js';

const db = createDb();
console.log(`数据库就绪：${DB_PATH}`);
const tables = (
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{
    name: string;
  }>
).map((r) => r.name);
console.log('表清单：', tables.join(', '));
db.close();
