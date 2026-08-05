import { createDb } from './db/client.js';
import { buildApp } from './app.js';
import { createRepos } from './db/repo/index.js';
import { startOrderExpiryTask } from './jobs/expireOrders.js';
import { startDataCleanupTask } from './jobs/dataCleanup.js';
import { config } from './config.js';

const PORT = config.port;
const HOST = config.host;

/**
 * 签名密钥强校验：生产环境必须显式提供 FATE_SECRET，
 * 否则拒绝启动（硬编码开发密钥仅限本地开发，生产泄漏会导致 token 可伪造）。
 */
if (config.env === 'production' && !process.env.FATE_SECRET) {
  console.error('[fate] 生产环境必须设置 FATE_SECRET 环境变量，已拒绝启动。');
  process.exit(1);
}
if (!process.env.FATE_SECRET) {
  console.warn('[fate] 警告：未设置 FATE_SECRET，token/签名使用开发默认密钥，仅限本地开发。');
}

const db = createDb();
const app = buildApp(db);

/** 后台定时任务：待支付订单过期清理（不阻塞进程退出） */
const stopOrderExpiry = startOrderExpiryTask(createRepos(db));
/** 后台定时任务：数据生命周期治理（孤儿记录/过期验证码/超期游客，周期可配置） */
const stopDataCleanup = startDataCleanupTask(createRepos(db));

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`fate-engine server listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

/** 优雅停机：关闭 HTTP 连接 → 关闭数据库（WAL 落盘），避免进程被杀导致半写 */
async function shutdown(signal: string): Promise<void> {
  app.log.info(`收到 ${signal}，正在优雅停机...`);
  const force = setTimeout(() => {
    console.error('[fate] 优雅停机超时（5s），强制退出。');
    process.exit(1);
  }, 5000);
  force.unref();
  try {
    stopOrderExpiry();
    stopDataCleanup();
    await app.close();
  } catch (err) {
    app.log.error(err);
  } finally {
    clearTimeout(force);
    db.close();
    process.exit(0);
  }
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
