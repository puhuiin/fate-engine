import { config } from '../config.js';

/**
 * OpenAPI 3.0 JSON 契约（零依赖手写）。
 * 供前端/第三方工具消费：端点清单、鉴权方案、统一 ApiResp 包装、限流语义。
 * 端点与 routes/ 一一对应，新增路由需同步登记；verify_api 有存在性断言兜底。
 */
export function buildOpenApiDoc(): Record<string, unknown> {
  const bearer = {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  };
  const auth = [{ bearerAuth: [] }];
  const jsonBody = (schema: Record<string, unknown>, required: string[] = []) => ({
    content: { 'application/json': { schema: { type: 'object', properties: schema, required } } },
  });
  const okResp = (desc: string) => ({
    description: desc,
    content: { 'application/json': { schema: { type: 'object' } } },
  });

  const paths: Record<string, unknown> = {
    '/api/health': {
      get: {
        summary: '健康检查（含 pid / 内存 / 库体占用 / 九层版本）',
        security: [],
        responses: { 200: okResp('服务与数据库状态'), 503: okResp('数据库不可达') },
      },
    },
    '/api/health/live': {
      get: {
        summary: '存活探针（进程可达即 200，轻量高频）',
        security: [],
        responses: { 200: okResp('进程存活') },
      },
    },
    '/api/health/ready': {
      get: {
        summary: '就绪探针（DB 可达才 200，否则 503 摘流）',
        security: [],
        responses: { 200: okResp('实例就绪'), 503: okResp('依赖未就绪') },
      },
    },
    '/api/openapi.json': {
      get: {
        summary: 'API 契约文档',
        security: [],
        responses: { 200: okResp('OpenAPI 3.0 JSON') },
      },
    },
    '/api/v1/locations/search': {
      get: {
        summary: '城市检索（录入页自动补全）',
        security: [],
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: okResp('城市列表') },
      },
    },
    '/api/v1/auth/guest': {
      post: {
        summary: '游客登录（自动创建游客账号）',
        security: [],
        requestBody: jsonBody({ nickname: { type: 'string', maxLength: 30 } }),
        responses: { 200: okResp('{ user, token }') },
      },
    },
    '/api/v1/auth/sms/send': {
      post: {
        summary: '发送短信验证码（认证接口独立限流 20 次/分）',
        security: [],
        requestBody: jsonBody({ phone: { type: 'string' }, channel: { type: 'string' } }, [
          'phone',
        ]),
        responses: { 200: okResp('发送结果'), 429: okResp('频繁请求被限流') },
      },
    },
    '/api/v1/auth/phone': {
      post: {
        summary: '手机号+验证码登录（可携带游客 token 合并数据）',
        security: [],
        requestBody: jsonBody(
          {
            phone: { type: 'string' },
            code: { type: 'string' },
            nickname: { type: 'string', maxLength: 30 },
            mergeGuestToken: { type: 'string' },
          },
          ['phone', 'code'],
        ),
        responses: { 200: okResp('{ user, token, merged }') },
      },
    },
    '/api/v1/auth/me': {
      get: { summary: '当前用户信息', security: auth, responses: { 200: okResp('用户资料') } },
    },
    '/api/v1/auth/profile': {
      patch: {
        summary: '更新个人资料（昵称）',
        security: auth,
        requestBody: jsonBody({ nickname: { type: 'string', maxLength: 30 } }),
        responses: { 200: okResp('更新后用户') },
      },
    },
    '/api/v1/archives': {
      post: {
        summary: '创建出生档案',
        security: auth,
        requestBody: jsonBody({ solarDate: { type: 'string' }, gender: { type: 'string' } }, [
          'solarDate',
        ]),
        responses: { 200: okResp('新档案') },
      },
      get: { summary: '我的档案列表', security: auth, responses: { 200: okResp('档案数组') } },
    },
    '/api/v1/archives/{id}': {
      get: { summary: '档案详情', security: auth, responses: { 200: okResp('档案') } },
      patch: { summary: '编辑档案', security: auth, responses: { 200: okResp('更新后档案') } },
      delete: {
        summary: '删除档案（级联清理记录/方案/订单）',
        security: auth,
        responses: { 200: okResp('{ removedRecords }') },
      },
    },
    '/api/v1/calculate': {
      post: {
        summary: '发起九层测算（standard/quantum/ultimate）',
        security: auth,
        requestBody: jsonBody({ archiveId: { type: 'integer' }, calcType: { type: 'string' } }, [
          'archiveId',
        ]),
        responses: { 200: okResp('{ recordId }') },
      },
    },
    '/api/v1/records': {
      get: {
        summary: '我的测算记录（分页）',
        security: auth,
        responses: { 200: okResp('{ total, rows }') },
      },
    },
    '/api/v1/records/{id}': {
      get: {
        summary: '记录详情（未付费仅可见免费层，付费后全量）',
        security: auth,
        responses: { 200: okResp('记录与报告') },
      },
      delete: { summary: '删除记录', security: auth, responses: { 200: okResp('删除结果') } },
    },
    '/api/v1/records/{id}/plans': {
      get: {
        summary: '改运方案（付费后完整）',
        security: auth,
        responses: { 200: okResp('方案列表') },
      },
    },
    '/api/v1/records/{id}/risks': {
      get: { summary: '风险预警列表', security: auth, responses: { 200: okResp('风险数组') } },
    },
    '/api/v1/plans/{id}': {
      patch: {
        summary: '更新方案状态（如标记完成）',
        security: auth,
        requestBody: jsonBody({ status: { type: 'string' } }),
        responses: { 200: okResp('更新后方案') },
      },
    },
    '/api/v1/orders': {
      post: {
        summary: '创建解锁订单（¥99）',
        security: auth,
        requestBody: jsonBody({ recordId: { type: 'integer' } }, ['recordId']),
        responses: { 200: okResp('订单，重复下单返回同一 pending 订单') },
      },
      get: {
        summary: '我的订单历史',
        security: auth,
        responses: { 200: okResp('订单数组（倒序）') },
      },
    },
    '/api/v1/orders/{id}/pay': {
      post: {
        summary: '支付解锁（渠道白名单校验）',
        security: auth,
        requestBody: jsonBody({ channel: { type: 'string' } }),
        responses: { 200: okResp('{ paidStatus }') },
      },
    },
    '/api/v1/orders/{id}/cancel': {
      post: {
        summary: '取消待支付订单（作废为 expired）',
        security: auth,
        responses: { 200: okResp('取消后订单') },
      },
    },
    '/api/v1/orders/status/{recordId}': {
      get: {
        summary: '订单状态查询（含锁定层与最新订单）',
        security: auth,
        responses: { 200: okResp('{ paidStatus, lockedLayers, order }') },
      },
    },
    '/api/v1/stats/overview': {
      get: { summary: '个人统计概览', security: auth, responses: { 200: okResp('统计汇总') } },
    },
    '/api/v1/kernel/log': {
      post: {
        summary: '内核日志上报（长度受限）',
        security: auth,
        requestBody: jsonBody({
          version: { type: 'string' },
          ruleName: { type: 'string' },
          ruleDetail: { type: 'string' },
        }),
        responses: { 200: okResp('写入结果') },
      },
    },
    '/api/v1/kernel/logs': {
      get: { summary: '内核日志查询', security: auth, responses: { 200: okResp('日志列表') } },
    },
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'fate-engine API',
      version: '0.1.0',
      description:
        '全域超验无限命运演算系统后端 API。统一响应包装 { code, msg, data }；未标注安全方案的端点需 `Authorization: Bearer <token>`；全局限流 300 次/分、认证接口 20 次/分，超限返回 429 并附 X-RateLimit-* / Retry-After 头。',
    },
    servers: [{ url: '/' }],
    components: { ...bearer },
    paths,
    'x-rate-limit': {
      global: { max: config.globalRateMax, windowMs: config.rateWindowMs },
      auth: { max: config.authRateMax, windowMs: config.rateWindowMs },
    },
  };
}

/** 契约文档惰性缓存：文档为纯静态结构，避免每次请求重建（对象字面量较大） */
let openApiCache: Record<string, unknown> | null = null;

export function cachedOpenApiDoc(): Record<string, unknown> {
  if (!openApiCache) openApiCache = buildOpenApiDoc();
  return openApiCache;
}
