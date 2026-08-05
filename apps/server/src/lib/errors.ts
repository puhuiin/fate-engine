/**
 * 业务错误类型：携带 HTTP 状态码，由全局错误处理器统一转换为 ApiResp。
 * 路由层以 throw 方式表达业务失败，替代「return reply.send(fail(...))」样板，
 * 保持统一错误语义（code === HTTP status，响应体为 { code, msg, data: null }）。
 */
export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}
