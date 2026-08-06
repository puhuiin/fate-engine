import type { Repos } from '../db/repo/index.js';
import { config } from '../config.js';

export interface DataCleanupStats {
  /** 引用缺失（档案/用户已不存在）的孤儿测算记录 */
  orphanRecords: number;
  /** 已过期短信验证码 */
  expiredSms: number;
  /** 超期未绑定手机号的游客账号（含级联数据） */
  staleGuests: number;
}

const utcNowOffset = (offsetMs: number): string =>
  new Date(Date.now() - offsetMs).toISOString().replace('T', ' ').slice(0, 19);

/**
 * 数据生命周期治理（单次执行，幂等可重入）：
 * 1. 孤儿测算记录——档案或归属用户已不存在（FK 兜底，先清理其子表再删除）
 * 2. 过期短信验证码
 * 3. 超期游客——未绑定手机号且超保留期，事务级联清理档案/记录/订单
 */
export function runDataCleanup(repos: Repos): DataCleanupStats {
  const stats: DataCleanupStats = { orphanRecords: 0, expiredSms: 0, staleGuests: 0 };

  const orphanIds = repos.db
    .prepare(
      `SELECT id FROM calculate_record
       WHERE archive_id NOT IN (SELECT id FROM user_birth_archive)
          OR user_id NOT IN (SELECT id FROM sys_user)`,
    )
    .all() as Array<{ id: number }>;
  if (orphanIds.length > 0) {
    const tx = repos.db.transaction(() => {
      for (const { id } of orphanIds) {
        repos.db.prepare('DELETE FROM luck_plan WHERE record_id = ?').run(id);
        repos.db.prepare('DELETE FROM risk_item WHERE record_id = ?').run(id);
        repos.db.prepare('DELETE FROM order_pay WHERE record_id = ?').run(id);
        repos.db.prepare('DELETE FROM calculate_record WHERE id = ?').run(id);
      }
    });
    tx();
  }
  stats.orphanRecords = orphanIds.length;

  stats.expiredSms = repos.sms.deleteExpired();

  const cutoff = utcNowOffset(config.guestTtlDays * 24 * 3600 * 1000);
  const staleGuestIds = repos.db
    .prepare(
      `SELECT id FROM sys_user
       WHERE register_channel = 'guest' AND phone IS NULL AND created_at < ?`,
    )
    .all(cutoff) as Array<{ id: number }>;

  const deleteUserCascade = repos.db.transaction((userId: number) => {
    const records = repos.db
      .prepare('SELECT id FROM calculate_record WHERE user_id = ?')
      .all(userId) as Array<{ id: number }>;
    for (const { id } of records) {
      repos.db.prepare('DELETE FROM luck_plan WHERE record_id = ?').run(id);
      repos.db.prepare('DELETE FROM risk_item WHERE record_id = ?').run(id);
      repos.db.prepare('DELETE FROM order_pay WHERE record_id = ?').run(id);
      repos.db.prepare('DELETE FROM calculate_record WHERE id = ?').run(id);
    }
    repos.db.prepare('DELETE FROM order_pay WHERE user_id = ?').run(userId);
    repos.db.prepare('DELETE FROM user_birth_archive WHERE user_id = ?').run(userId);
    repos.db.prepare('DELETE FROM sys_user WHERE id = ?').run(userId);
  });
  for (const { id } of staleGuestIds) {
    deleteUserCascade(id);
  }
  stats.staleGuests = staleGuestIds.length;

  return stats;
}

/**
 * 数据清理后台任务：启动即清一轮，此后按 config.dataCleanupIntervalMs 周期执行。
 * 返回 stop 函数供优雅停机；timer.unref() 确保不阻止进程退出。
 * intervalMs <= 0 时仅执行首轮、不调度周期。
 */
export function startDataCleanupTask(
  repos: Repos,
  intervalMs = config.dataCleanupIntervalMs,
  onRun?: (stats: DataCleanupStats) => void,
): () => void {
  const run = () => {
    try {
      const stats = runDataCleanup(repos);
      if (stats.orphanRecords || stats.expiredSms || stats.staleGuests) {
        console.log(
          `[fate] 数据清理：孤儿记录 ${stats.orphanRecords}、过期验证码 ${stats.expiredSms}、超期游客 ${stats.staleGuests}`,
        );
      }
      onRun?.(stats);
    } catch (err) {
      console.error('[fate] 数据清理失败：', err);
    }
  };
  run();
  if (intervalMs <= 0) return () => undefined;
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
