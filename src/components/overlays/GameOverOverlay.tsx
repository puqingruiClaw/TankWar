import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameOverReason } from '@/components/GameCanvas'

/**
 * GameOverOverlay —— 结束一局。
 *
 * PRD §2.3：红色 GAME OVER 像素字体，从底部升起动画，3s 后返回菜单（或用户按 RETRY/MENU）。
 *
 * T-20 增强：
 * - 大标题使用新增的 `animate-game-over-rise` —— 1s ease-out 完成
 *   `translateY(60%) opacity 0` → `translateY(0) opacity 1`，配合 tailwind
 *   [tailwind.config.js](file:///Users/puqingrui/workspace/Projects/TankWar/tailwind.config.js#L100-L109) 中新增的 keyframes。
 * - 文字色改为 `text-hud-danger`（PRD 定义的红 `#d63a2f`），比原来的
 *   `text-tank-enemyArmor` 更符合"红色 GAME OVER"叙述。
 *
 * T-25 UX 打磨：
 * - 增加 **Enter=RETRY / Esc=MENU** 键盘捷径。以 capture=true 挂载 window
 *   keydown，抢在 [InputSystem](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/systems/InputSystem.ts#L40-L46) 之前消费事件，避免 Esc
 *   在 game-over 阶段还去触发 pause 冗余边沿；同时也不打扰 [NameEntryOverlay](file:///Users/puqingrui/workspace/Projects/TankWar/src/components/overlays/NameEntryOverlay.tsx)
 *   —— 因为父级 PlayPage 在 pendingRecord 存在时不会挂本 Overlay。
 */
export interface GameOverInfo {
  reason: GameOverReason
  score: number
  stageId: number
}

export interface GameOverOverlayProps {
  info: GameOverInfo
  onRetry: () => void
}

export default function GameOverOverlay({ info, onRetry }: GameOverOverlayProps) {
  const navigate = useNavigate()
  const reasonLabel = info.reason === 'base-destroyed' ? 'YOUR BASE FELL' : 'ALL LIVES LOST'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onRetry()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        navigate('/')
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onRetry, navigate])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-black/90 font-pixel text-white">
      <div className="animate-game-over-rise flex flex-col items-center">
        <p className="text-pixel-2xl text-hud-danger">GAME</p>
        <p className="text-pixel-2xl text-hud-danger">OVER</p>
      </div>
      <p className="mt-4 text-pixel-sm text-outline">{reasonLabel}</p>
      <p className="mt-4 text-pixel-lg">
        SCORE <span className="text-hud-accent">{info.score.toString().padStart(6, '0')}</span>
      </p>
      <p className="mt-1 text-pixel-sm text-outline">
        STAGE {info.stageId.toString().padStart(2, '0')}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="border-2 border-outline px-4 py-2 font-pixel text-pixel-sm text-hud-accent hover:bg-outline/30"
        >
          RETRY
        </button>
        <a
          href="#/"
          className="border-2 border-outline px-4 py-2 font-pixel text-pixel-sm text-white hover:bg-outline/30"
        >
          MENU
        </a>
      </div>
      <p className="mt-4 text-pixel-xs text-outline">
        <span className="text-hud-accent">ENTER</span> RETRY ·{' '}
        <span className="text-hud-accent">ESC</span> MENU
      </p>
    </div>
  )
}
