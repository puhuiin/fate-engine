import type { Db } from '../client.js';
import { createUserRepo } from './users.js';
import { createArchiveRepo } from './archives.js';
import { createRecordRepo } from './records.js';
import { createOrderRepo } from './orders.js';
import { createPlanRepo } from './plans.js';
import { createRiskRepo } from './risks.js';
import { createSmsRepo } from './sms.js';
import { createKernelRepo } from './kernel.js';
import { createStatsRepo } from './stats.js';

export { USER_PUBLIC_COLS } from './users.js';
export type { UserRepo } from './users.js';
export type { ArchiveRepo, ArchiveInsert } from './archives.js';
export type { RecordRepo } from './records.js';
export type { OrderRepo } from './orders.js';
export type { PlanRepo, PlanInput } from './plans.js';
export type { RiskRepo, RiskInput } from './risks.js';
export type { SmsRepo } from './sms.js';
export type { KernelRepo, KernelLogInput } from './kernel.js';
export type { StatsRepo } from './stats.js';

/**
 * 仓储集合：应用所有数据库访问的唯一入口。
 * 路由层通过 Repos 读取/写入数据，不再直接持有 Db 与内嵌 SQL。
 * db 仅用于跨实体的复合事务编排（如游客数据合并），常规读写一律走具体 repo。
 */
export interface Repos {
  db: Db;
  users: ReturnType<typeof createUserRepo>;
  archives: ReturnType<typeof createArchiveRepo>;
  records: ReturnType<typeof createRecordRepo>;
  orders: ReturnType<typeof createOrderRepo>;
  plans: ReturnType<typeof createPlanRepo>;
  risks: ReturnType<typeof createRiskRepo>;
  sms: ReturnType<typeof createSmsRepo>;
  kernel: ReturnType<typeof createKernelRepo>;
  stats: ReturnType<typeof createStatsRepo>;
}

export function createRepos(db: Db): Repos {
  return {
    db,
    users: createUserRepo(db),
    archives: createArchiveRepo(db),
    records: createRecordRepo(db),
    orders: createOrderRepo(db),
    plans: createPlanRepo(db),
    risks: createRiskRepo(db),
    sms: createSmsRepo(db),
    kernel: createKernelRepo(db),
    stats: createStatsRepo(db),
  };
}
