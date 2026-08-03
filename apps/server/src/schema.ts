import { z } from 'zod';

/** 校验公历日期真实存在（YYYY-MM-DD 且可 round-trip），拒绝 2026-02-30 等 */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 校验时间范围（HH:mm[:ss]），拒绝 24:99 等非法读数 */
export function isRealTime(value: string): boolean {
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) return false;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  const ss = parts[2] === undefined ? 0 : Number(parts[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || !Number.isInteger(ss)) return false;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return false;
  return true;
}

export const phoneLoginSchema = z.object({
  phone: z.string().regex(/^1\d{10}$/, '手机号格式不正确'),
  code: z.string().min(4).max(8),
  nickname: z.string().trim().min(1).max(30).optional(),
});

export const sendSmsSchema = z.object({
  phone: z.string().regex(/^1\d{10}$/, '手机号格式不正确'),
  channel: z.enum(['login']).default('login'),
});

export const guestSchema = z.object({
  nickname: z.string().trim().min(1).max(30).optional(),
});

export const archiveCreateSchema = z.object({
  gender: z.enum(['male', 'female', 'other']).optional(),
  solarDate: z.string().refine(isRealDate, '日期不存在，应为有效公历日期（YYYY-MM-DD）'),
  solarTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, '时间格式应为 HH:mm')
    .refine(isRealTime, '时间不存在，小时 0-23、分钟/秒 0-59')
    .optional(),
  timePrecision: z.enum(['minute', 'hour', 'day', 'fuzzy']).default('minute'),
  sourceReliability: z.enum(['certificate', 'family', 'estimate', 'unknown']).default('unknown'),
  cityName: z.string().max(40).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  timezoneOffset: z.number().min(-12).max(14).optional(),
  timeSource: z.string().max(50).optional(),
  note: z.string().max(200).optional(),
});

/** 档案编辑：全部字段可选，字段级 refine（真实日期/时间）在 partial 后仍保留 */
export const archiveUpdateSchema = archiveCreateSchema.partial();

export const calculateSchema = z.object({
  archiveId: z.number().int().positive(),
  calcType: z.enum(['standard', 'quantum', 'ultimate']).default('standard'),
});
