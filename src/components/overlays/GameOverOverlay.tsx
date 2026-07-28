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
  const reasonLabel = info.reason === 'base-destroyed' ? 'YOUR BASE FELL' : 'ALL LIVES LOST'
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
    </div>
  )
}
