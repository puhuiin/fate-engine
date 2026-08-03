# fate-engine · 全域超验无限命运演算系统

一个前后端分离的占卜类 Web 应用，采用「真太阳时校时 → 多流派排盘 → 九层结构输出 → 付费解锁深度内容」的完整产品闭环。

> 本项目以工程化方式实现传统术数的计算与展示，**所有输出仅供文化研究与娱乐参考，不构成任何决策依据**。项目刻意避免宿命论与恐吓话术，并以「30% 先天 + 20% 流年 + 50% 人为」的权重结构强调人的主体性。

---

## 功能特性

### 九层报告结构（L1–L9）
| 层 | 名称 | 说明 |
|----|------|------|
| L1 | 时空校正 | 真太阳时换算（经度修正 + 均时差）、跨日/夏令时边界处理、数据可信度评级 |
| L2 | 术数双流派 | 八字（含流派统一口径：23 点换日、分秒级起运）并行计算并输出流派标注 |
| L3 | 科学祛魅 | 概率参照系、样本偏差说明，弱化确定性宣称 |
| L4 | 综合研判 | 30% 先天 + 20% 流年 + 50% 人为权重合成综合指数 |
| L5 | 因果溯源 | 识别"求认可与自我证明"类核心卡点（含缺五行模式） |
| L6 | 量子多线 | 四条平行发展线 + 契合度 + 未来分叉点 + 风险提示 |
| L7 | 元规则内核 | 冲突裁定（以日主为纲、纳音为参），并强调人为权重过半 |
| L8 | 七级改运 | 分七级落库的可执行计划，支持每日打卡 |
| L9 | 实相兜底 | 三课结构与行运窗口，含合规声明 |

### 产品闭环
- **登录体系**：游客 / 手机号验证码（dev 模式回显 devCode），JWT 无状态鉴权
- **档案管理**：个人命理档案 CRUD，记录生日、性别、出生地、时间精度、时区偏移等
- **付费解锁**：L4–L9 深度层默认 locked，订单 + mock 支付渠道解锁（支持 wechat / alipay / mock 白名单）
- **七级改运打卡**：逐条完成计划、更新状态、记录完成时间
- **内核迭代留痕**：规则调整通过 `kernel_log` 表持久化，可追溯版本演进
- **导出报告**：前端将九层内容导出为纯文本

---

## 技术栈

| 端 | 技术 |
|----|------|
| 后端 | Node.js + TypeScript + Fastify + better-sqlite3 + lunar-javascript + zod |
| 前端 | React 18 + Vite + react-router-dom |
| 校验 | 5 组确定性回归脚本（44 + 8 + 15 + 42 + 71 = 180 断言） |

---

## 快速开始

### 环境要求
- Node.js ≥ 18
- npm ≥ 9

### 安装与启动

```bash
npm install
npm run dev
```

- 后端：http://localhost:3001（`GET /api/health` 健康检查）
- 前端：http://localhost:5173（Vite 已配置 `/api` 反向代理到后端，无跨域问题）

### 环境变量（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端监听端口 |
| `HOST` | `0.0.0.0` | 后端监听地址 |
| `NODE_ENV` | `development` | 生产环境需设为 `production` |
| `FATE_SECRET` | 开发内置密钥 | JWT/签名的唯一私密源，**生产环境必填，未设置将拒绝启动** |

### 构建生产版本

```bash
npm run build        # 编译后端 TS + 前端产物
npm run start        # 以 node dist 启动后端
```

---

## 验证与回归

```bash
# 全量回归（180 断言）
npm run verify -w @fate/server

# 分块验证
npm run verify:l1 -w @fate/server   # 真太阳时/跨日/夏令时边界（8 用例）
npm run verify:l2 -w @fate/server   # 八字流派/大运顺逆（15 断言）
npm run verify:l3 -w @fate/server   # L5–L9 确定性输出（42 断言）
npm run verify:api -w @fate/server  # 接口层（71 断言，内存 SQLite + inject）
```

断言覆盖真实业务基准：如 `2002-11-29 20:40 北京男` → 真太阳时 20.604、戌时、日主辛/金、日柱辛丑、L4 事业 68。

---

## API 概览

所有业务接口返回统一结构 `{ code, msg, data }`，除登录/游客/健康检查外均需携带 `Authorization: Bearer <token>`。

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/guest` | 游客登录 |
| POST | `/api/v1/auth/sms/send` | 发送短信验证码（dev 模式回显 `devCode`，60s 重发限流） |
| POST | `/api/v1/auth/phone` | 手机号 + 验证码登录 |
| GET | `/api/v1/auth/me` | 当前用户信息 |

### 档案
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/archives` | 创建档案 |
| GET | `/api/v1/archives` | 档案列表 |
| GET | `/api/v1/archives/:id` | 档案详情 |
| PATCH | `/api/v1/archives/:id` | 编辑档案（字段级校验） |
| DELETE | `/api/v1/archives/:id` | 删除档案（级联删除其测算记录，越权返回 404） |

### 测算与报告
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/calculate` | 发起测算，写入记录 + 七级改运计划 + 风险项 |
| GET | `/api/v1/records` | 测算记录列表（分页可选，不含内部字段） |
| GET | `/api/v1/records/:id` | 报告详情（未解锁时 L4–L9 为 `locked`） |
| GET | `/api/v1/records/:id/plans` | 七级改运计划（未解锁返回空数据） |
| GET | `/api/v1/records/:id/risks` | 风险项（L5 卡点 + L6 分叉点） |
| PATCH | `/api/v1/plans/:id` | 打卡更新计划（未解锁 403） |
| DELETE | `/api/v1/records/:id` | 删除记录 |

### 付费
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/orders` | 创建解锁订单（¥99） |
| POST | `/api/v1/orders/:id/pay` | 支付解锁（渠道白名单校验） |
| GET | `/api/v1/orders/status/:recordId` | 订单状态查询 |

### 内核
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/kernel/log` | 记录规则迭代（字段限长校验） |
| GET | `/api/v1/kernel/logs?version=` | 查询内核演进日志 |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/v1/locations/search?q=` | 城市经纬度搜索（query 截断 ≤20） |

---

## 项目结构

```
fate-engine/
├── apps/
│   ├── server/
│   │   ├── scripts/          # verify_all/l1/l2/l3/api 回归脚本
│   │   └── src/
│   │       ├── index.ts      # 入口（生产 FATE_SECRET 强校验）
│   │       ├── app.ts        # Fastify 组装 + 统一错误处理
│   │       ├── schema.ts     # zod 输入校验
│   │       ├── routes/       # auth/archives/calculate/orders/plans/kernel
│   │       ├── modules/
│   │       │   ├── l1/       # 时空校正（dst 夏令时 / location / time / rating）
│   │       │   ├── l2/       # 八字双流派
│   │       │   ├── l3/ … l9/ # 后续各层，l6 含 risk.ts 风险落库
│   │       ├── lib/          # util.ts（parseId / verifyToken / 签名）
│   │       ├── db/           # better-sqlite3 连接与建表
│   │       └── report.ts     # 九层报告聚合
│   └── web/
│       └── src/
│           ├── api/          # client.ts（15s 超时、401 自动登出）
│           └── pages/        # Input / Loading / Report / History
└── package.json              # npm workspaces
```

---

## 安全与工程约定

- **密钥管理**：`FATE_SECRET` 为 JWT/签名唯一私密源，生产缺省拒绝启动（显式失败优于静默弱密钥）
- **鉴权**：`timingSafeEqual` 恒定时间比较 + token payload 严格校验
- **输入加固**：日期 round-trip 校验、时间范围校验、支付渠道白名单、字段限长（备注 ≤200、version ≤20 等）
- **防泄漏**：所有对外响应剥离内部字段（`user_id` / `raw_json` / 明文 phone）；`raw_json` 损坏时降级为 `dataError` 而非报错
- **越权防护**：档案删除级联、记录列表 JOIN 均带 `user_id` 过滤；他人资源返回 404
- **事务一致性**：测算写入（记录 + 计划 + 风险）由外层单一事务包裹，禁止嵌套事务

---

## 合规声明

本项目的排盘、分析、建议全部基于传统文化算法与概率化参照，**仅供娱乐与文化研究，不构成心理、医疗、投资或任何重大决策建议**。报告刻意不输出宿命论与恐吓话术，并始终强调人为选择对结果的影响力。

---

## License

Private / Internal. All rights reserved.
