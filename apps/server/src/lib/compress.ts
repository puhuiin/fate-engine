import type { FastifyInstance } from 'fastify';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/** 低于该字节数的响应不值得压缩（开销大于收益） */
const MIN_COMPRESS_BYTES = 512;

/**
 * 响应 gzip 压缩（零第三方依赖，基于 node:zlib）。
 * 仅对 Accept-Encoding 声明 gzip 且体积达标的 JSON 响应启用；
 * 纯内存压缩，单机小规模足够；大并发生产建议改用 @fastify/compress 或前置网关。
 */
export function registerCompression(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply, payload) => {
    if (typeof payload !== 'string') return payload;
    if (!/gzip/.test(req.headers['accept-encoding'] ?? '')) return payload;
    if (payload.length < MIN_COMPRESS_BYTES) return payload;
    if (reply.getHeader('content-encoding')) return payload;
    if (reply.raw.headersSent) return payload;

    try {
      const compressed = await gzipAsync(Buffer.from(payload));
      reply.header('content-encoding', 'gzip');
      return compressed;
    } catch {
      // 压缩失败回退原文，保证可用性
      return payload;
    }
  });
}

/** 供回归测试验证：直接压缩/解压工具 */
export async function compressText(text: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(text));
}

export async function decompress(buf: Buffer): Promise<string> {
  return (await gunzipAsync(buf)).toString('utf-8');
}
