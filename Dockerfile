# syntax=docker/dockerfile:1
# =============================================================
# fate-engine 单容器部署镜像（API + 前端静态资源一体化）
# 多阶段构建：依赖安装 → 构建产物 → 精简运行镜像
# =============================================================

# ---- 阶段 1：安装全量依赖（含 devDependencies，用于构建）----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# ---- 阶段 2：构建后端 TS + 前端 Vite 产物 ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- 阶段 3：精简运行镜像（仅生产依赖 + 构建产物）----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    WEB_DIST_DIR=/app/apps/web/dist

WORKDIR /app

# 只安装生产依赖（better-sqlite3 等原生模块在 glibc 环境有预编译产物）
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev && npm cache clean --force

# 合并前后端构建产物
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

# 数据目录（SQLite 持久化卷）；运行时属主由入口脚本修正为 node 用户
RUN mkdir -p /app/data
VOLUME ["/app/data"]

WORKDIR /app/apps/server
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || exit 1

# 降权运行：入口脚本先修正数据卷属主，再以非 root 的 node 用户（uid 1000）启动主进程，
# 在不牺牲 SQLite 可写性的前提下缩小容器被攻破后的影响面。
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
