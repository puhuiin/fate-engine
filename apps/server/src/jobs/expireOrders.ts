import type { Repos } from '../db/repo/index.js';
import { config } from '../config.js';

/**
 * 待支付订单过期后台清理任务。
 * 按固定间隔扫描全库，将超过 FATE_ORDER_TTL_SECONDS 的 pending 订单置为 expired，
 * 兜底「下单后不再访问」场景下的僵尸订单；同时是下单接口单记录作废的补充保障。
 *
 * 返回 stop 函数用于优雅停机；timer.unref() 确保其不阻止进程退出。
 */
export function startOrderExpiryTask(repos: Repos, intervalMs = 60_000): () => void {
  const run = () => {
    try {
      const changed = repos.orders.expireAllPending(config.orderTtlMs);
      if (changed > 0) {
        console.log(`[fate] 订单过期清理：作废 ${changed} 条待支付订单`);
      }
    } catch (err) {
      console.error('[fate] 订单过期清理失败：', err);
    }
  };
  // 启动即先清理一轮（服务重启后可立即回收历史僵尸订单）
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
