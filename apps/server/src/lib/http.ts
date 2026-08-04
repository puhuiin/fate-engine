import type { FastifyRequest } from 'fastify';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { ApiError } from './errors.js';
import { parseId } from './util.js';

/**
 * 请求校验辅助：收敛「safeParse + fail(400)」样板。
 * 校验失败抛 ApiError(400)，由全局错误处理器统一响应。
 */
export function assertSchema<T extends ZodTypeAny>(
  schema: T,
  value: unknown,
  fallback = '参数错误',
): ZodInfer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? fallback);
  }
  return parsed.data;
}

/**
 * 从 URL 路径参数提取并校验正整数 id（parseId 仅接受十进制正整数串）。
 * 失败抛 ApiError(400)，避免脏参数透传到 SQL。
 */
export function requireIdParam(req: FastifyRequest, name: string): number {
  const id = parseId((req.params as Record<string, string | undefined>)[name]);
  if (!id) {
    throw new ApiError(400, `参数 ${name} 不合法`);
  }
  return id;
}
