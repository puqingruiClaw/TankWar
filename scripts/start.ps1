# TankWar · 一键启动开发服务器（Windows PowerShell）
#
# 与 scripts/start.sh 语义一致：
#   1. 校验 Node ≥ 18
#   2. 若无 pnpm，尝试 corepack enable
#   3. 缺 node_modules 就 pnpm install --frozen-lockfile
#   4. 启动 pnpm dev
#
# 用法：
#   pwsh scripts/start.ps1        # PowerShell 7+
#   powershell -File scripts/start.ps1   # Windows 5.1 内建版

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir '..')
Set-Location $ProjectRoot

Write-Host "▶ TankWar dev launcher"
Write-Host "  project root: $ProjectRoot"

function Assert-Command($name, $installHint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Error "$name 不可用。$installHint"
    exit 1
  }
}

Assert-Command 'node' '请从 https://nodejs.org/ 安装 Node 18 或更高版本。'

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) {
  Write-Error "Node 版本 $(node -v) 过低，需要 ≥ 18。"
  exit 1
}
Write-Host "  ✓ node $(node -v)"

if (-not (Get-Command 'pnpm' -ErrorAction SilentlyContinue)) {
  Write-Host "  pnpm 未安装，尝试 corepack enable..."
  if (Get-Command 'corepack' -ErrorAction SilentlyContinue) {
    corepack enable | Out-Null
  }
}
Assert-Command 'pnpm' "请执行 'npm install -g pnpm' 或参见 https://pnpm.io/installation"
Write-Host "  ✓ pnpm $(pnpm -v)"

if (-not (Test-Path 'node_modules')) {
  Write-Host "  · node_modules 缺失，执行 pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
} else {
  Write-Host "  · node_modules 已存在，跳过 install"
}

Write-Host "▶ 启动 Vite dev server（Ctrl+C 退出）"
Write-Host "  默认地址：http://localhost:5173/"
pnpm dev
