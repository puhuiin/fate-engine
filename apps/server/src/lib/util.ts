import crypto from 'node:crypto';
import { config } from '../config.js';

export function md5(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}

export interface ApiResp {
  code: number;
  msg: string;
  data: unknown;
  timestamp: number;
  sign: string;
}

export function ok(data: unknown, msg = '操作成功'): ApiResp {
  const timestamp = Math.floor(Date.now() / 1000);
  const json = JSON.stringify(data ?? {});
  const sign = md5(`${timestamp}|${json}|${config.secret}`).slice(0, 16);
  return { code: 200, msg, data, timestamp, sign };
}

export function fail(code: number, msg: string): ApiResp {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = md5(`${timestamp}||${config.secret}`).slice(0, 16);
  return { code, msg, data: null, timestamp, sign };
}

/** 签发 N 秒有效 token（HMAC 签名，无需外部依赖），有效期可经 FATE_TOKEN_TTL_SECONDS 配置 */
export function signToken(userId: number): string {
  const payload = `${userId}.${Date.now() + config.tokenTtlSeconds * 1000}`;
  const sig = crypto.createHmac('sha256', config.secret).update(payload).digest('hex').slice(0, 24);
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyToken(token?: string): { userId: number } | null {
  if (!token || token.length > config.tokenMaxLength) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, 'base64url').toString();
  const expect = crypto
    .createHmac('sha256', config.secret)
    .update(payload)
    .digest('hex')
    .slice(0, 24);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const parts = payload.split('.');
  if (parts.length !== 2) return null;
  const userId = Number(parts[0]);
  const exp = Number(parts[1]);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(exp)) return null;
  if (exp < Date.now()) return null;
  return { userId };
}

export function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

/** 严格解析路径/请求 id：仅接受十进制正整数串，拒绝十六进制、科学计数法与超 int64 数值，避免脏参数透传到 SQL */
export function parseId(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
