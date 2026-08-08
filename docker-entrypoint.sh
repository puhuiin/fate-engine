#!/bin/sh
set -e

# fate-engine 容器入口：降权运行前确保数据卷可写。
#
# 挂载的命名卷（如 compose 的 fate-data）通常以 root 属主初始化，
# 若直接以非 root 用户运行，SQLite 将无法在 /app/data 写入 fate.db。
# 此处入口仍以 root 执行，修正归属后再切换至 node 用户（uid 1000）启动主进程，
# 在不牺牲可写性的前提下缩小容器被攻破后的影响面。

if [ -d /app/data ]; then
  chown -R node:node /app/data 2>/dev/null || true
fi

# 切换到非 root 用户运行主进程；-s /bin/sh 规避 node 用户可能的 nologin shell。
exec su -s /bin/sh node -c "$*"
