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

/** 优雅停机硬超时：超过则强制退出，防止卡死导致容器编排无法回收 */
const SHUTDOWN_TIMEOUT_MS = 5000;
/** 重入保护：信号与未捕获异常可能并发触发，仅首次执行的 drain 生效 */
let shuttingDown = false;

/**
 * 优雅停机：关闭 HTTP 连接 → 关闭数据库（WAL 落盘），避免进程被杀导致半写。
 * 由信号（SIGINT/SIGTERM）或未捕获异常（uncaughtException/unhandledRejection）触发；
 * 重入保护避免多次 drain 叠加；超时强退兜底，保证进程一定退出。
 */
async function gracefulShutdown(reason: string, err?: unknown, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  if (err !== undefined) {
    app.log.error({ err, reason }, `未捕获异常，触发优雅停机：${reason}`);
  } else {
    app.log.info(`收到 ${reason}，正在优雅停机...`);
  }
  const force = setTimeout(() => {
    console.error('[fate] 优雅停机超时（5s），强制退出。');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();
  try {
    stopOrderExpiry();
    stopDataCleanup();
    await app.close();
  } catch (e) {
    app.log.error(e);
  } finally {
    clearTimeout(force);
    db.close();
    process.exit(exitCode);
  }
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
/**
 * 进程韧性兜底：未捕获异常 / 未处理 Promise 拒绝时，不再以未知状态继续服务，
 * 而是按优雅停机流程排空连接、落盘数据库后非零退出（容器编排自动重启拉起）。
 * 避免半坏进程静默存活导致数据脏写或请求错乱。
 */
process.on('uncaughtException', (err) => void gracefulShutdown('uncaughtException', err, 1));
process.on(
  'unhandledRejection',
  (reason) => void gracefulShutdown('unhandledRejection', reason, 1),
);
