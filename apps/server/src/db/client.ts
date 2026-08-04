import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export const DB_PATH = config.dbPath;

/** PRD「6. 数据库核心表结构」7 张表 DDL */
export const DDL = `
CREATE TABLE IF NOT EXISTS sys_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE,
  phone_masked TEXT,
  nickname TEXT,
  register_channel TEXT NOT NULL DEFAULT 'guest',
  member_level INTEGER NOT NULL DEFAULT 0,
  member_expire_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_birth_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  gender TEXT,
  solar_date TEXT NOT NULL,
  solar_time TEXT,
  timezone_offset REAL,
  longitude REAL,
  latitude REAL,
  city_name TEXT,
  province TEXT,
  time_source TEXT,
  time_precision TEXT NOT NULL DEFAULT 'minute',
  source_reliability TEXT NOT NULL DEFAULT 'unknown',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calculate_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archive_id INTEGER NOT NULL REFERENCES user_birth_archive(id),
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  calc_type TEXT NOT NULL DEFAULT 'standard' CHECK (calc_type IN ('standard', 'quantum', 'ultimate')),
  raw_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_status INTEGER NOT NULL DEFAULT 0 CHECK (paid_status IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS risk_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES calculate_record(id),
  year TEXT,
  risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 5),
  trigger_condition TEXT,
  mitigation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS luck_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES calculate_record(id),
  level INTEGER CHECK (level BETWEEN 1 AND 7),
  title TEXT,
  content TEXT,
  exec_cycle TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_pay (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE,
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  record_id INTEGER REFERENCES calculate_record(id),
  amount_cents INTEGER,
  pay_channel TEXT,
  entitlement_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kernel_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT,
  rule_name TEXT,
  rule_detail TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sms_code (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'login',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archive_user ON user_birth_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_record_user ON calculate_record(user_id);
CREATE INDEX IF NOT EXISTS idx_record_created ON calculate_record(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_code(phone);
CREATE INDEX IF NOT EXISTS idx_record_archive ON calculate_record(archive_id);
CREATE INDEX IF NOT EXISTS idx_risk_record ON risk_item(record_id);
CREATE INDEX IF NOT EXISTS idx_order_record ON order_pay(record_id, user_id);
CREATE INDEX IF NOT EXISTS idx_order_user ON order_pay(user_id, id);
CREATE INDEX IF NOT EXISTS idx_plan_record ON luck_plan(record_id);
`;

export type Db = Database.Database;

export function createDb(dbPath: string = DB_PATH): Db {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.exec(DDL);
  migrateColumns(db);
  db.prepare("DELETE FROM sms_code WHERE expires_at <= datetime('now')").run();
  return db;
}

/** 对已存在的旧库做幂等补列（CREATE TABLE IF NOT EXISTS 不会修改旧表） */
function migrateColumns(db: Db): void {
  const colsOf = (table: string) =>
    new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name),
    );

  const archive = colsOf('user_birth_archive');
  if (!archive.has('time_precision')) {
    db.exec(`ALTER TABLE user_birth_archive ADD COLUMN time_precision TEXT NOT NULL DEFAULT 'minute'`);
  }
  if (!archive.has('source_reliability')) {
    db.exec(
      `ALTER TABLE user_birth_archive ADD COLUMN source_reliability TEXT NOT NULL DEFAULT 'unknown'`,
    );
  }

  const plan = colsOf('luck_plan');
  if (!plan.has('status')) {
    db.exec(`ALTER TABLE luck_plan ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!plan.has('finished_at')) {
    db.exec(`ALTER TABLE luck_plan ADD COLUMN finished_at TEXT`);
  }

  const order = colsOf('order_pay');
  if (!order.has('record_id')) {
    db.exec(`ALTER TABLE order_pay ADD COLUMN record_id INTEGER REFERENCES calculate_record(id)`);
  }

  const sms = colsOf('sms_code');
  if (!sms.has('fail_count')) {
    db.exec(`ALTER TABLE sms_code ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0`);
  }
}
