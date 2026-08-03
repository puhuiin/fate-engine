import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** 通过 Bearer token 解析出的用户 ID */
    userId?: number;
  }
}
