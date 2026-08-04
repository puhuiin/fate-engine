import type { FastifyRequest } from 'fastify';
import type { ZodTypeAny, infer as ZodInfer, ZodIssue } from 'zod';
import { ApiError } from './errors.js';
import { parseId } from './util.js';

/**
 * 将 Zod 默认英文错误消息映射为中文（自定义中文 message 保留）。
 * 避免「Expected number, received string」这类英文直接暴露给用户。
 */
function zodIssueMessage(issue: ZodIssue): string | null {
  const { message } = issue;
  // 自定义中文 message（regex/enum/refine/email 带 message 参数的）原样保留
  if (/[\u4e00-\u9fa5]/.test(message)) return null;
  switch (issue.code) {
    case 'invalid_type':
      return `字段类型不正确（应为 ${issue.expected}，实际为 ${issue.received}）`;
    case 'invalid_literal':
      return '字段取值不合法';
    case 'invalid_enum_value':
      return `字段取值不合法（应为：${issue.options.join(' / ')}）`;
    case 'invalid_string':
      return '字段格式不正确';
    case 'too_small':
    case 'too_big':
      return '字段长度或取值超出允许范围';
    case 'invalid_date':
      return '日期格式不正确';
    default:
      return null;
  }
}

/**
 * 请求校验辅助：收敛「safeParse + fail(400)」样板。
 * 校验失败抛 ApiError(400)，由全局错误处理器统一响应。
 * Zod 默认英文错误消息会映射为中文，避免英文堆栈直接暴露给用户。
 */
export function assertSchema<T extends ZodTypeAny>(
  schema: T,
  value: unknown,
  fallback = '参数错误',
): ZodInfer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, zodIssueMessage(issue) ?? issue?.message ?? fallback);
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
