import 'fastify';
import type { authenticate } from './lib/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * 通过 Bearer token 解析出的用户 ID。
     * 由 authenticate preHandler 填充，仅保证在配置了该 preHandler 的路由内可用。
     */
    userId: number;
  }

  interface FastifyInstance {
    /** 全局挂载的 Bearer 鉴权 preHandler（见 lib/auth.ts） */
    authenticate: typeof authenticate;
  }
}
