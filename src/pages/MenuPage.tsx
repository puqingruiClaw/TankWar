import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LEADERBOARD_STORAGE_KEY } from '@/game/constants'

/**
 * MenuPage —— T-18：把最初的"三行菜单原型"升级成完整 FC 街机风开始菜单。
 *
 * 结构（自上而下）：
 *   ┌─ HUD 顶栏：I-PLAYER 与 HI-SCORE，两列等宽 —— 复刻《Battle City》标题画面。
 *   ├─ 大号 LOGO：BATTLE / CITY 双色像素字 + 右侧 500ms 闪烁的像素小坦克 (inline SVG)。
 *   ├─ 主菜单：4 项，键盘 ↑/↓/W/S 选择，Enter/Space 确认。
 *   │           选中项以 ► 闪烁光标提示（.pixel-cursor + .pixel-cursor--blink）。
 *   │           STAGE SELECT 属"占位入口"—— 视觉出现但被禁用，避免超前实现 T-15+ 的选关流程。
 *   └─ 底部 footer：操作提示 + 版权行；"— PRESS ENTER —" 继续沿用 animate-blink。
 *
 * 无新增第三方依赖、无新资源、无破坏 route/store 的约定，纯 DOM 层升级。
 */

interface MenuItem {
  label: string
  to: string
  disabled?: boolean
  hint?: string
}

const MENU_ITEMS: readonly MenuItem[] = [
  { label: '1 PLAYER', to: '/play' },
  { label: 'STAGE SELECT', to: '/play', disabled: true, hint: 'COMING SOON' },
  { label: 'LEADERBOARD', to: '/leaderboard' },
  { label: 'HELP', to: '/help' },
] as const

/**
 * 从 localStorage 读取本地排行榜的最高分。
 * - 仅读，不写；容错任何 JSON / 结构异常，缺省 0。
 * - T-21 会写入这块数据；T-18 只是"提前展示"。
 */
function useHiScore(): number {
  return useMemo(() => {
    if (typeof window === 'undefined') return 0
    try {
      const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY)
      if (!raw) return 0
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return 0
      let best = 0
      for (const row of parsed) {
        if (row && typeof row === 'object' && 'score' in row) {
          const s = Number((row as { score: unknown }).score)
          if (Number.isFinite(s) && s > best) best = s
        }
      }
      return best
    } catch {
      return 0
    }
  }, [])
}

export default function MenuPage() {
  const navigate = useNavigate()
  const hiScore = useHiScore()

  const firstEnabled = MENU_ITEMS.findIndex((m) => !m.disabled)
  const [index, setIndex] = useState(firstEnabled === -1 ? 0 : firstEnabled)

  /**
   * 让选择在"可用项"之间循环，跳过 disabled 项。
   * 传入方向 +1（下）或 -1（上），返回下一个 enabled index；若全 disabled 则返回原值。
   */
  const stepIndex = (from: number, delta: 1 | -1): number => {
    const n = MENU_ITEMS.length
    for (let step = 1; step <= n; step++) {
      const next = (from + delta * step + n * step) % n
      if (!MENU_ITEMS[next].disabled) return next
    }
    return from
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          setIndex((i) => stepIndex(i, -1))
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          setIndex((i) => stepIndex(i, 1))
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = MENU_ITEMS[index]
          if (!item.disabled) navigate(item.to)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, navigate])

  return (
    <div className="stage crt-scanlines no-smoothing">
      <div className="flex h-full w-full flex-col p-tile">
        {/* ─── 顶栏：I-PLAYER / HI-SCORE ─────────────────────── */}
        <div className="flex items-baseline justify-between font-pixel text-pixel-sm">
          <span className="text-hud-accent">
            I-PLAYER <span className="text-white">00</span>
          </span>
          <span className="text-hud-accent">
            HI-SCORE <span className="text-white">{hiScore.toString().padStart(6, '0')}</span>
          </span>
        </div>

        {/* ─── LOGO：BATTLE / CITY + 闪烁像素小坦克 ─────────── */}
        <header className="mt-tile flex items-center justify-center gap-6">
          <div className="text-right">
            <h1 className="font-display text-pixel-3xl leading-none text-tank-player">BATTLE</h1>
            <h1 className="mt-2 font-display text-pixel-3xl leading-none text-white">CITY</h1>
            <p className="mt-3 font-pixel text-pixel-sm text-outline">
              坦克大战 · v0.1 · WEB EDITION
            </p>
          </div>
          <PixelTankIcon className="animate-blink" />
        </header>

        {/* ─── 主菜单 ──────────────────────────────────────── */}
        <section
          className="pixel-frame pixel-frame--accent mx-auto mt-tile w-72"
          aria-label="Main menu"
        >
          <ul className="flex flex-col gap-3" role="menu">
            {MENU_ITEMS.map((item, i) => {
              const active = i === index
              const disabled = !!item.disabled
              return (
                <li
                  key={item.label}
                  role="none"
                  className={
                    'font-pixel text-pixel-lg ' +
                    (active
                      ? 'pixel-cursor pixel-cursor--blink text-hud-accent'
                      : 'pl-6 ' + (disabled ? 'text-muted' : 'text-white'))
                  }
                >
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={active ? 'true' : undefined}
                    aria-disabled={disabled || undefined}
                    disabled={disabled}
                    onClick={() => !disabled && navigate(item.to)}
                    onMouseEnter={() => !disabled && setIndex(i)}
                    className={
                      'bg-transparent p-0 font-pixel text-pixel-lg text-inherit ' +
                      (disabled ? 'cursor-not-allowed' : '')
                    }
                  >
                    {item.label}
                    {item.hint && (
                      <span className="ml-3 font-pixel text-pixel-sm text-outline">
                        {item.hint}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* ─── Footer：操作提示 + 版权 ──────────────────────── */}
        <footer className="mt-auto text-center font-pixel text-pixel-sm text-outline">
          <p>
            <span className="text-hud-accent">↑↓</span> SELECT ·{' '}
            <span className="text-hud-accent">ENTER</span> CONFIRM
          </p>
          <p className="mt-2 animate-blink text-white">— PRESS ENTER —</p>
          <p className="mt-3 text-pixel-xs text-muted">
            © 2026 TankWar · WEB EDITION · NAMCO 1985 TRIBUTE
          </p>
        </footer>
      </div>
    </div>
  )
}

/**
 * PixelTankIcon —— T-18 用的一枚 12×12 网格 inline SVG 像素小坦克。
 *
 * 之所以内联而非引入 sprite / 复用 canvas 的 drawTankSprite：
 * 1. 菜单页属"纯 DOM 层"（PRD 4.1），不该临时挂 canvas；
 * 2. 无需新增 assets 目录里的资源文件，保持仓库清爽；
 * 3. SVG 自身继承全局 image-rendering: pixelated（见 index.css），
 *    放大到 96×96 仍是硬边像素效果。
 *
 * 图形按玩家坦克（黄）配色，履带 & 炮管走深色，与 tank-player 主题呼应。
 */
function PixelTankIcon({ className = '' }: { className?: string }) {
  const S = 8
  const P = '#e6e62e'
  const D = '#5c2610'
  const cells: Array<[number, number, string]> = [
    // Turret barrel (col 5-6, row 0-2)
    [5, 0, D],
    [6, 0, D],
    [5, 1, D],
    [6, 1, D],
    // Body top (row 2-3)
    [2, 2, P],
    [3, 2, P],
    [4, 2, P],
    [5, 2, P],
    [6, 2, P],
    [7, 2, P],
    [8, 2, P],
    [9, 2, P],
    [2, 3, P],
    [3, 3, P],
    [4, 3, P],
    [5, 3, P],
    [6, 3, P],
    [7, 3, P],
    [8, 3, P],
    [9, 3, P],
    // Turret cap (row 4-5, middle)
    [4, 4, D],
    [5, 4, P],
    [6, 4, P],
    [7, 4, D],
    [4, 5, D],
    [5, 5, P],
    [6, 5, P],
    [7, 5, D],
    // Body middle
    [2, 6, P],
    [3, 6, P],
    [4, 6, P],
    [5, 6, P],
    [6, 6, P],
    [7, 6, P],
    [8, 6, P],
    [9, 6, P],
    // Tread rails (row 7-9, cols 1-2 and 9-10, alternating dark)
    [1, 7, P],
    [2, 7, D],
    [3, 7, P],
    [4, 7, P],
    [5, 7, P],
    [6, 7, P],
    [7, 7, P],
    [8, 7, P],
    [9, 7, D],
    [10, 7, P],
    [1, 8, P],
    [2, 8, P],
    [3, 8, D],
    [4, 8, D],
    [5, 8, D],
    [6, 8, D],
    [7, 8, D],
    [8, 8, D],
    [9, 8, P],
    [10, 8, P],
    [1, 9, P],
    [2, 9, D],
    [3, 9, P],
    [4, 9, P],
    [5, 9, P],
    [6, 9, P],
    [7, 9, P],
    [8, 9, P],
    [9, 9, D],
    [10, 9, P],
  ]

  return (
    <svg
      aria-hidden
      className={className}
      width={12 * S}
      height={12 * S}
      viewBox={`0 0 ${12 * S} ${12 * S}`}
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="transparent" />
      {cells.map(([cx, cy, color], k) => (
        <rect key={k} x={cx * S} y={cy * S} width={S} height={S} fill={color} />
      ))}
    </svg>
  )
}
