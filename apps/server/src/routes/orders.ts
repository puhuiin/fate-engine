import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { ok } from '../lib/util.js';
import { ApiError } from '../lib/errors.js';
import { assertSchema, requireIdParam } from '../lib/http.js';
import type { Repos } from '../db/repo/index.js';
import { lockedLayers } from '../report.js';
import { orderCreateSchema, orderPaySchema } from '../schema.js';

/** 深度报告解锁价格（分）：¥99 */
const UNLOCK_PRICE_CENTS = config.unlockPriceCents;

/** 支付渠道白名单（mock 为开发模拟渠道） */
const PAY_CHANNELS = new Set(config.payChannels);

/** 待支付订单有效期：默认 30 分钟，超时自动失效（防僵尸订单堆积） */
const ORDER_TTL_MS = config.orderTtlMs;

type OrderRow = Record<string, unknown>;

/** 订单对外字段白名单：剥离 user_id 等内部字段 */
function orderPublic(o: OrderRow): OrderRow {
  const { user_id: _uid, ...rest } = o;
  return rest;
}

export function orderRoutes(app: FastifyInstance, repos: Repos): void {
  /** 我的订单历史：全部订单倒序（含关联测算摘要），供「我的记录」页订单区展示 */
  app.get('/api/v1/orders', { preHandler: app.authenticate }, async (req) => {
    const rows = repos.orders.listByUser(req.userId);
    return ok(rows.map(orderPublic));
  });

  /** 为指定测算记录创建解锁订单（已付费直接返回已解锁） */
  app.post('/api/v1/orders', { preHandler: app.authenticate }, async (req, reply) => {
    const { recordId } = assertSchema(orderCreateSchema, req.body ?? {}, 'recordId 参数错误');
    const record = repos.records.findMetaById(recordId, req.userId);
    if (!record) {
      throw new ApiError(404, '记录不存在或无权访问');
    }
    if (record.paid_status === 1) {
      return reply.send(ok({ alreadyUnlocked: true, paidStatus: 1 }, '已解锁'));
    }

    const tx = repos.db.transaction((): { existing?: OrderRow; created?: OrderRow } => {
      // 过期的待支付订单统一作废，避免用户被陈年僵尸订单卡住
      repos.orders.expirePendingByRecord(recordId, req.userId, ORDER_TTL_MS);
      const pending = repos.orders.latestPendingByRecord(recordId, req.userId);
      if (pending) return { existing: pending };
      const orderNo = `FT${Date.now()}${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      const orderId = repos.orders.insert(recordId, req.userId, UNLOCK_PRICE_CENTS, orderNo);
      const created = repos.orders.findById(orderId);
      return { created };
    });
    const result = tx();
    if (result.existing) {
      return reply.send(
        ok({ order: orderPublic(result.existing), alreadyUnlocked: false }, '存在待支付订单'),
      );
    }
    return reply.send(
      ok({ order: orderPublic(result.created as OrderRow), alreadyUnlocked: false }, '订单已创建'),
    );
  });

  /**
   * 模拟支付成功（开发阶段：无需真实支付回调）。
   * 生产环境替换为第三方支付回调签名校验，成功后调用本逻辑。
   */
  app.post('/api/v1/orders/:id/pay', { preHandler: app.authenticate }, async (req, reply) => {
    const id = requireIdParam(req, 'id');
    const { channel } = assertSchema(
      orderPaySchema,
      req.body ?? {},
      'pay_channel 不合法（mock/wechat/alipay）',
    );
    if (!PAY_CHANNELS.has(channel)) {
      throw new ApiError(400, 'pay_channel 不合法（mock/wechat/alipay）');
    }
    const order = repos.orders.findByIdAndUser<
      Record<string, unknown> & {
        id: number;
        record_id: number | null;
        entitlement_status: string;
        created_at: string;
      }
    >(id, req.userId);
    if (!order) {
      throw new ApiError(404, '订单不存在或无权访问');
    }
    if (order.entitlement_status === 'granted') {
      return reply.send(ok({ order: orderPublic(order), paidStatus: 1 }, '订单已支付'));
    }
    if (order.entitlement_status === 'expired') {
      throw new ApiError(410, '订单已过期，请重新下单');
    }
    if (!order.record_id) {
      throw new ApiError(400, '订单未关联测算记录');
    }
    if (repos.orders.isExpired(order.created_at, ORDER_TTL_MS)) {
      repos.orders.markExpired(order.id);
      throw new ApiError(410, '订单已过期，请重新下单');
    }

    const rec = repos.db
      .prepare('SELECT paid_status FROM calculate_record WHERE id = ?')
      .get(order.record_id) as { paid_status: number } | undefined;
    if (rec && rec.paid_status === 1) {
      repos.orders.markGrantedById(order.id);
      const granted = repos.orders.findById(order.id);
      return reply.send(
        ok({ order: orderPublic(granted as OrderRow), paidStatus: 1 }, '记录已解锁'),
      );
    }

    const tx = repos.db.transaction(() => {
      repos.orders.markGranted(order.id, channel);
      repos.records.markPaid(order.record_id as number);
    });
    tx();

    const granted = repos.orders.findById(order.id);
    return reply.send(
      ok({ order: orderPublic(granted as OrderRow), paidStatus: 1 }, '支付成功，深度报告已解锁'),
    );
  });

  /** 查询某记录解锁状态与最新订单 */
  app.get(
    '/api/v1/orders/status/:recordId',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const recordId = requireIdParam(req, 'recordId');
      const record = repos.records.findMetaById(recordId, req.userId);
      if (!record) {
        throw new ApiError(404, '记录不存在或无权访问');
      }
      const order = repos.orders.latestByRecord(recordId, req.userId);
      return reply.send(
        ok({
          paidStatus: record.paid_status,
          lockedLayers: lockedLayers(record.paid_status === 1),
          order: order ? orderPublic(order) : null,
        }),
      );
    },
  );
}
