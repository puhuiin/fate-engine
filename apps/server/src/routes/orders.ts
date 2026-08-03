import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { fail, ok, parseId } from '../lib/util.js';
import type { Db } from '../db/client.js';
import { requireAuth } from './auth.js';
import { lockedLayers } from '../report.js';

/** 深度报告解锁价格（分）：¥99 */
const UNLOCK_PRICE_CENTS = 9900;

/** 支付渠道白名单（mock 为开发模拟渠道） */
const PAY_CHANNELS = new Set(['mock', 'wechat', 'alipay']);

interface RecordRow {
  id: number;
  paid_status: number;
}

type OrderRow = Record<string, unknown>;

/** 订单对外字段白名单：剥离 user_id 等内部字段 */
function orderPublic(o: OrderRow): OrderRow {
  const { user_id: _uid, ...rest } = o;
  return rest;
}

export function orderRoutes(app: FastifyInstance, db: Db): void {
  /** 为指定测算记录创建解锁订单（已付费直接返回已解锁） */
  app.post('/api/v1/orders', { preHandler: requireAuth }, async (req, reply) => {
    const body = (req.body ?? {}) as { recordId?: number };
    const recordId = parseId(body.recordId);
    if (!recordId) {
      return reply.send(fail(400, 'recordId 参数错误'));
    }
    const record = db
      .prepare('SELECT id, paid_status FROM calculate_record WHERE id = ? AND user_id = ?')
      .get(recordId, req.userId) as RecordRow | undefined;
    if (!record) {
      return reply.send(fail(404, '记录不存在或无权访问'));
    }
    if (record.paid_status === 1) {
      return reply.send(ok({ alreadyUnlocked: true, paidStatus: 1 }, '已解锁'));
    }

    const tx = db.transaction((): { existing?: OrderRow; created?: OrderRow } => {
      const pending = db
        .prepare(
          `SELECT * FROM order_pay
           WHERE record_id = ? AND user_id = ? AND entitlement_status = 'pending'
           ORDER BY id DESC LIMIT 1`,
        )
        .get(recordId, req.userId) as OrderRow | undefined;
      if (pending) return { existing: pending };
      const orderNo = `FT${Date.now()}${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      const info = db
        .prepare(
          `INSERT INTO order_pay (order_no, user_id, record_id, amount_cents, entitlement_status)
           VALUES (?, ?, ?, ?, 'pending')`,
        )
        .run(orderNo, req.userId, recordId, UNLOCK_PRICE_CENTS);
      const created = db
        .prepare('SELECT * FROM order_pay WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as OrderRow | undefined;
      return { created };
    });
    const result = tx();
    if (result.existing) {
      return reply.send(ok({ order: orderPublic(result.existing), alreadyUnlocked: false }, '存在待支付订单'));
    }
    return reply.send(ok({ order: orderPublic(result.created as OrderRow), alreadyUnlocked: false }, '订单已创建'));
  });

  /**
   * 模拟支付成功（开发阶段：无需真实支付回调）。
   * 生产环境替换为第三方支付回调签名校验，成功后调用本逻辑。
   */
  app.post('/api/v1/orders/:id/pay', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    if (!id) {
      return reply.send(fail(400, '参数 id 不合法'));
    }
    const body = (req.body ?? {}) as { channel?: string };
    const channel = String(body.channel ?? 'mock').trim();
    if (!PAY_CHANNELS.has(channel)) {
      return reply.send(fail(400, 'pay_channel 不合法（mock/wechat/alipay）'));
    }
    const order = db
      .prepare('SELECT * FROM order_pay WHERE id = ? AND user_id = ?')
      .get(id, req.userId) as (Record<string, unknown> & {
      id: number;
      record_id: number | null;
      entitlement_status: string;
    }) | undefined;
    if (!order) {
      return reply.send(fail(404, '订单不存在或无权访问'));
    }
    if (order.entitlement_status === 'granted') {
      return reply.send(ok({ order: orderPublic(order), paidStatus: 1 }, '订单已支付'));
    }
    if (!order.record_id) {
      return reply.send(fail(400, '订单未关联测算记录'));
    }

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE order_pay SET entitlement_status = 'granted', pay_channel = ?
         WHERE id = ?`,
      ).run(channel, order.id);
      db.prepare('UPDATE calculate_record SET paid_status = 1 WHERE id = ?').run(order.record_id);
    });
    tx();

    const granted = db.prepare('SELECT * FROM order_pay WHERE id = ?').get(order.id);
    return reply.send(ok({ order: orderPublic(granted as OrderRow), paidStatus: 1 }, '支付成功，深度报告已解锁'));
  });

  /** 查询某记录解锁状态与最新订单 */
  app.get('/api/v1/orders/status/:recordId', { preHandler: requireAuth }, async (req, reply) => {
    const recordId = parseId((req.params as { recordId: string }).recordId);
    if (!recordId) {
      return reply.send(fail(400, '参数 recordId 不合法'));
    }
    const record = db
      .prepare('SELECT paid_status FROM calculate_record WHERE id = ? AND user_id = ?')
      .get(recordId, req.userId) as RecordRow | undefined;
    if (!record) {
      return reply.send(fail(404, '记录不存在或无权访问'));
    }
    const order = db
      .prepare(
        `SELECT * FROM order_pay WHERE record_id = ? AND user_id = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(recordId, req.userId);
    return ok({
      paidStatus: record.paid_status,
      lockedLayers: lockedLayers(record.paid_status === 1),
      order: order ? orderPublic(order as OrderRow) : null,
    });
  });
}
