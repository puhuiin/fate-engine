import type { FastifyReply, FastifyRequest } from 'fastify';
import { fail } from './util.js';

export interface RateLimitOptions {
  max: number;
  /** 时间窗口（毫秒） */
  windowMs: number;
}

/**
 * 进程内 IP 维度滑动窗口限流，返回 onRequest 钩子。
 * 自研实现（零第三方依赖）：每 IP 仅保留窗口内时间戳，超限直接 429。
 * 单进程部署适用；多实例需外置存储（Redis 等）做共享桶。
 */
export function createRateLimitHook({ max, windowMs }: RateLimitOptions) {
  const buckets = new Map<string, number[]>();
  let lastSweep = Date.now();
  const sweepInterval = 5 * 60 * 1000;

  return async function rateLimitHook(req: FastifyRequest, reply: FastifyReply) {
    const now = Date.now();
    const ip = req.ip || 'anonymous';
    const cutoff = now - windowMs;

    const ts = buckets.get(ip);
    if (!ts) {
      buckets.set(ip, [now]);
      return;
    }

    // 丢弃窗口外时间戳，桶体积至多 max 条/ip
    let i = 0;
    while (i < ts.length && ts[i] <= cutoff) i++;
    const live = i > 0 ? ts.slice(i) : ts;

    if (live.length >= max) {
      reply.code(429).send(fail(429, '请求过于频繁，请稍后再试'));
      return;
    }
    live.push(now);
    buckets.set(ip, live);

    // 周期性全量清理（每 5 分钟），防冷门 IP 桶长期滞留内存
    if (now - lastSweep > sweepInterval) {
      lastSweep = now;
      for (const [k, arr] of buckets) {
        let j = 0;
        while (j < arr.length && arr[j] <= cutoff) j++;
        if (j >= arr.length) buckets.delete(k);
      }
    }
  };
}
