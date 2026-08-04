import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * 通过 Bearer token 解析出的用户 ID。
     * 由 requireAuth preHandler 填充，仅保证在配置了该 preHandler 的路由内可用。
     */
    userId: number;
  }
}
