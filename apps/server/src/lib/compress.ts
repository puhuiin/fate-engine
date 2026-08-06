import type { FastifyInstance } from 'fastify';
import { brotliCompress, brotliDecompress, gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const brotliAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

/** 低于该字节数的响应不值得压缩（开销大于收益） */
const MIN_COMPRESS_BYTES = 512;

/**
 * 按客户端 Accept-Encoding 选择最佳编码：
 * 优先 brotli（对 JSON 文本压缩率显著优于 gzip，约再省 15-20%），回退 gzip。
 * 仅做存在性匹配，不解析 q 值权重（API 场景足够）。
 */
function pickEncoding(acceptEncoding: string | undefined): 'br' | 'gzip' | null {
  if (!acceptEncoding) return null;
  const ae = acceptEncoding.toLowerCase();
  if (ae.includes('br')) return 'br';
  if (ae.includes('gzip')) return 'gzip';
  return null;
}

/**
 * 响应压缩（零第三方依赖，基于 node:zlib）：客户端声明 br 时优先 brotli，否则回退 gzip。
 * 仅对 Accept-Encoding 命中且体积达标的 JSON 响应启用；压缩失败回退原文保证可用性。
 * 纯内存压缩，单机小规模足够；大并发生产建议改用 @fastify/compress 或前置网关。
 */
export function registerCompression(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply, payload) => {
    if (typeof payload !== 'string') return payload;
    const encoding = pickEncoding(req.headers['accept-encoding']);
    if (!encoding) return payload;
    if (payload.length < MIN_COMPRESS_BYTES) return payload;
    if (reply.getHeader('content-encoding')) return payload;
    if (reply.raw.headersSent) return payload;

    try {
      const buf = Buffer.from(payload);
      if (encoding === 'br') {
        const compressed = await brotliAsync(buf);
        reply.header('content-encoding', 'br');
        return compressed;
      }
      const compressed = await gzipAsync(buf);
      reply.header('content-encoding', 'gzip');
      return compressed;
    } catch {
      // 压缩失败回退原文，保证可用性
      return payload;
    }
  });
}

/** 供回归测试验证：直接 gzip 压缩/解压工具 */
export async function compressText(text: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(text));
}

export async function decompress(buf: Buffer): Promise<string> {
  return (await gunzipAsync(buf)).toString('utf-8');
}

/** 供回归测试验证：brotli 解压工具 */
export async function decompressBrotli(buf: Buffer): Promise<string> {
  return (await brotliDecompressAsync(buf)).toString('utf-8');
}
