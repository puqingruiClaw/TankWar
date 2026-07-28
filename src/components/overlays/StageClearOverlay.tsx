import { useEffect, useMemo, useState } from 'react'
import type { KillByKind } from '@/components/GameCanvas'
import { SCORE_TABLE, STAGE_CLEAR_TICK } from '@/game/constants'

/**
 * StageClearOverlay —— 关卡结算面板。
 *
 * 逐条统计：按 `basic → fast → power → armor` 顺序，每 [STAGE_CLEAR_TICK](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/constants.ts#L233-L233)
 * 秒揭示一行；全部揭示后显示 "TOTAL" 与关卡分数，然后父级 PlayPage 定时器自动切下一关。
 *
 * T-15：新增 `isFinalStage` —— 末关不再显示 "NEXT STAGE..."，改为
 * "MISSION COMPLETE..." 作为通关前奏；同一 timer 结束后 phase 会切到 game-complete。
 *
 * T-20：从 PlayPage 抽为独立文件，`StageClearInfo` 类型也一并对外导出。
 */
export interface StageClearInfo {
  killByKind: KillByKind
  score: number
  stageId: number
}

export interface StageClearOverlayProps {
  info: StageClearInfo
  isFinalStage: boolean
}

export default function StageClearOverlay({ info, isFinalStage }: StageClearOverlayProps) {
  const rows = useMemo(
    () =>
      (['basic', 'fast', 'power', 'armor'] as const).map((kind) => ({
        kind,
        count: info.killByKind[kind] ?? 0,
        unit: SCORE_TABLE[kind],
      })),
    [info],
  )
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setRevealed(i)
      if (i >= rows.length) window.clearInterval(id)
    }, STAGE_CLEAR_TICK * 1000)
    return () => window.clearInterval(id)
  }, [rows.length])

  const stageTotal = rows.reduce((acc, r) => acc + r.count * r.unit, 0)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/85 font-pixel text-white">
      <p className="text-pixel-2xl text-hud-accent">
        STAGE {info.stageId.toString().padStart(2, '0')}
      </p>
      <p className="mt-1 animate-blink text-pixel-lg text-hud-accent">CONGRATULATIONS!</p>
      <div className="mt-4 flex flex-col gap-1 text-pixel-sm">
        {rows.map((r, i) => (
          <div key={r.kind} className="grid grid-cols-3 gap-4">
            <span className="uppercase text-outline">{r.kind}</span>
            <span className="text-right text-white">
              {i < revealed ? r.count.toString().padStart(2, '0') : '--'} × {r.unit}
            </span>
            <span className="text-right text-hud-accent">
              {i < revealed ? (r.count * r.unit).toString().padStart(5, '0') : '-----'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-pixel-lg">
        TOTAL <span className="text-hud-accent">{stageTotal.toString().padStart(6, '0')}</span>
      </p>
      <p className="mt-6 animate-blink text-pixel-sm text-outline">
        {isFinalStage ? 'MISSION COMPLETE...' : 'NEXT STAGE...'}
      </p>
    </div>
  )
}
