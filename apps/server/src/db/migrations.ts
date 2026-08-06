import type { Db } from './client.js';

/** 数据库版本化迁移：schema 演进在启动时按版本顺序自动应用，升级安全可追溯 */
export interface Migration {
  version: number;
  name: string;
  up: (db: Db) => void;
}

/** 读取表结构，返回列名集合（迁移内幂等检查用） */
function colsOf(db: Db, table: string): Set<string> {
  return new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name),
  );
}

/**
 * 已发布的迁移清单（只允许追加，不允许修改已发布项）。
 * 每个 up 必须幂等：旧库可能已手动补过列，需先检查再变更。
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'archive_precision_columns',
    up: (db) => {
      const cols = colsOf(db, 'user_birth_archive');
      if (!cols.has('time_precision')) {
        db.exec(
          `ALTER TABLE user_birth_archive ADD COLUMN time_precision TEXT NOT NULL DEFAULT 'minute'`,
        );
      }
      if (!cols.has('source_reliability')) {
        db.exec(
          `ALTER TABLE user_birth_archive ADD COLUMN source_reliability TEXT NOT NULL DEFAULT 'unknown'`,
        );
      }
    },
  },
  {
    version: 2,
    name: 'plan_progress_columns',
    up: (db) => {
      const cols = colsOf(db, 'luck_plan');
      if (!cols.has('status')) {
        db.exec(`ALTER TABLE luck_plan ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
      }
      if (!cols.has('finished_at')) {
        db.exec(`ALTER TABLE luck_plan ADD COLUMN finished_at TEXT`);
      }
    },
  },
  {
    version: 3,
    name: 'order_record_link',
    up: (db) => {
      const cols = colsOf(db, 'order_pay');
      if (!cols.has('record_id')) {
        db.exec(
          `ALTER TABLE order_pay ADD COLUMN record_id INTEGER REFERENCES calculate_record(id)`,
        );
      }
    },
  },
  {
    version: 4,
    name: 'sms_fail_count',
    up: (db) => {
      const cols = colsOf(db, 'sms_code');
      if (!cols.has('fail_count')) {
        db.exec(`ALTER TABLE sms_code ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0`);
      }
    },
  },
];

const SCHEMA_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** 应用所有未执行的迁移，返回本次实际应用的版本列表。
 *  每个迁移与其版本记录在同一事务内执行：迁移失败整体回滚，
 *  避免「DDL 已变更但版本未登记」的半应用状态（下次启动重跑时会因列已存在而报错）。 */
export function runMigrations(db: Db): number[] {
  db.exec(SCHEMA_MIGRATIONS_DDL);
  const appliedVersions = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (r) => r.version,
    ),
  );
  const appliedNow: number[] = [];
  const apply = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');
  const applyOne = db.transaction((m: Migration) => {
    m.up(db);
    apply.run(m.version, m.name);
  });
  for (const m of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    if (appliedVersions.has(m.version)) continue;
    applyOne(m);
    appliedNow.push(m.version);
  }
  return appliedNow;
}

export function appliedMigrationVersions(db: Db): number[] {
  return (
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
      version: number;
    }>
  ).map((r) => r.version);
}
