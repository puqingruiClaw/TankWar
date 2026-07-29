#!/usr/bin/env bash
# TankWar · 一键生产预览（macOS / Linux）
#
# 与 start.sh 的差异：跑的是构建产物，不是 dev server。用途：
#   - 演示 v1.0 真实体验（无 HMR / 无 dev-locator）
#   - 手机 / 平板局域网验收（本脚本默认走 preview:host 暴露到 0.0.0.0）
#
# 用法：
#   ./scripts/preview.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "▶ TankWar production preview launcher"
echo "  project root: $PROJECT_ROOT"

# Node / pnpm 校验（与 start.sh 一致，保持行为对齐）
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js 未安装。请从 https://nodejs.org/ 安装 Node 18 或更高版本。" >&2
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Node 版本 $(node -v) 过低，需要 ≥ 18。" >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "✗ pnpm 不可用。请执行 'npm install -g pnpm'。" >&2
  exit 1
fi
echo "  ✓ node $(node -v) / pnpm $(pnpm -v)"

# 依赖 & 构建
if [ ! -d "node_modules" ]; then
  echo "  · node_modules 缺失，pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
fi

# 若 dist/ 缺失或早于源码，重新构建；简单起见每次都跑一次 build，
# 反正 Vite build 冷启动也就 1 秒左右
echo "  · pnpm build"
pnpm build

echo "▶ 启动 preview（Ctrl+C 退出）"
echo "  局域网访问：把 http://<你的 IP>:4173/ 输入手机浏览器"
exec pnpm preview:host
