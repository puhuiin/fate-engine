import { createDb } from './db/client.js';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * 签名密钥强校验：生产环境必须显式提供 FATE_SECRET，
 * 否则拒绝启动（硬编码开发密钥仅限本地开发，生产泄漏会导致 token 可伪造）。
 */
if (process.env.NODE_ENV === 'production' && !process.env.FATE_SECRET) {
  console.error('[fate] 生产环境必须设置 FATE_SECRET 环境变量，已拒绝启动。');
  process.exit(1);
}
if (!process.env.FATE_SECRET) {
  console.warn('[fate] 警告：未设置 FATE_SECRET，token/签名使用开发默认密钥，仅限本地开发。');
}

const db = createDb();
const app = buildApp(db);

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`fate-engine server listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
