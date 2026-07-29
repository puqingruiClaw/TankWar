#!/usr/bin/env bash
# TankWar · 一键启动开发服务器（macOS / Linux）
#
# 做的事：
#   1. 校验 Node ≥ 18；缺失/太旧则直接报错退出（早失败胜过后面 install 时莫名报错）
#   2. 确保有 pnpm；没有就尝试 corepack enable 拉起，避免逼用户手动装
#   3. 若 node_modules 不存在或过期，就 pnpm install --frozen-lockfile
#      —— frozen-lockfile 保证任何机器装出来都跟仓库对齐
#   4. 启动 pnpm dev（Vite HMR）
#
# 用法：
#   ./scripts/start.sh
# 或直接双击（macOS Finder 里 Right-click → Open with → Terminal）
#
# 设计取舍：
#   - 不用 pipefail 里的 set -e：install 或 dev 的非零退出应当直达用户，
#     而不是让脚本吃掉错误后自己 exit 1，那样 stack trace 会更难读
#   - 显式打印每一步的“在做什么”，让新人第一次跑时知道等的是什么
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "▶ TankWar dev launcher"
echo "  project root: $PROJECT_ROOT"

# --- 1. Node 版本校验 -----------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js 未安装。请从 https://nodejs.org/ 安装 Node 18 或更高版本后重试。" >&2
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ 当前 Node 版本 $(node -v) 过低，需要 ≥ 18。" >&2
  exit 1
fi
echo "  ✓ node $(node -v)"

# --- 2. 确保 pnpm 可用 ----------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  pnpm 未安装，尝试用 corepack enable 拉起..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "✗ 仍未找到 pnpm。请执行 'npm install -g pnpm' 或参见 https://pnpm.io/installation" >&2
  exit 1
fi
echo "  ✓ pnpm $(pnpm -v)"

# --- 3. 按需安装依赖 ------------------------------------------------------
# node_modules 存在但过期时 pnpm 会自己识别；这里只处理“压根没装”的常见情况
if [ ! -d "node_modules" ]; then
  echo "  · node_modules 缺失，执行 pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
else
  echo "  · node_modules 已存在，跳过 install（如遇诡异问题可手动删除后重跑）"
fi

# --- 4. 启动 dev server ---------------------------------------------------
echo "▶ 启动 Vite dev server（Ctrl+C 退出）"
echo "  默认地址：http://localhost:5173/"
exec pnpm dev
