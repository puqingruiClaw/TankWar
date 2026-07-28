import { TOTAL_STAGES } from '@/game/maps/levels'

/**
 * GameCompleteOverlay —— 一周目通关庆祝面板（T-15 引入，T-20 抽离）。
 *
 * 触发条件：末关 stage-clear 计时结束（不是 base 被毁 / 命耗尽）。
 * 展示：MISSION COMPLETE 大字 + 最终分数 + 关卡编号 + REPLAY / MENU；
 * 视觉上与 [GameOverOverlay](file:///Users/puqingrui/workspace/Projects/TankWar/src/components/overlays/GameOverOverlay.tsx) 保持结构一致，只用金色（hud-accent）替代红色，
 * 让"结束"与"通关"通过颜色一眼可辨。REPLAY 复用 PlayPage 的 handleRetry：回首关 + 清 session。
 */
export interface GameCompleteInfo {
  finalScore: number
  finalStageId: number
}

export interface GameCompleteOverlayProps {
  info: GameCompleteInfo
  onRetry: () => void
}

export default function GameCompleteOverlay({ info, onRetry }: GameCompleteOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 font-pixel text-white">
      <p className="text-pixel-2xl text-hud-accent">MISSION</p>
      <p className="text-pixel-2xl text-hud-accent">COMPLETE</p>
      <p className="mt-4 animate-blink text-pixel-sm text-hud-accent">
        ALL {TOTAL_STAGES} STAGES CLEARED
      </p>
      <p className="mt-4 text-pixel-lg">
        FINAL <span className="text-hud-accent">{info.finalScore.toString().padStart(6, '0')}</span>
      </p>
      <p className="mt-1 text-pixel-sm text-outline">
        LAST STAGE {info.finalStageId.toString().padStart(2, '0')}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="border-2 border-outline px-4 py-2 font-pixel text-pixel-sm text-hud-accent hover:bg-outline/30"
        >
          REPLAY
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
