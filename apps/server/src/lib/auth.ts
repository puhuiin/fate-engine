import type { FastifyReply, FastifyRequest } from 'fastify';
import { fail, verifyToken } from './util.js';

/**
 * 需登录接口的 preHandler 鉴权函数。
 * 通过 app.decorate('authenticate') 挂载，路由以 { preHandler: app.authenticate } 声明。
 */
export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    reply.code(401).send(fail(401, '未登录'));
    return;
  }
  const token = auth.slice(7).trim();
  if (!token) {
    reply.code(401).send(fail(401, '未登录'));
    return;
  }
  const v = verifyToken(token);
  if (!v) {
    reply.code(401).send(fail(401, '登录已过期，请重新登录'));
    return;
  }
  req.userId = v.userId;
  return undefined;
}
