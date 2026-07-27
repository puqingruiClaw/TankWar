import { useCallback, useState } from 'react'
import StageLayout from '@/layouts/StageLayout'
import GameCanvas from '@/components/GameCanvas'
import type { EngineStats } from '@/game/GameEngine'

const INITIAL_STATS: EngineStats = { fps: 0, ups: 0, frameMs: 0, time: 0 }

export default function PlayPage() {
  const [stats, setStats] = useState<EngineStats>(INITIAL_STATS)
  const handleStats = useCallback((s: EngineStats) => setStats(s), [])

  return (
    <StageLayout title="STAGE 01" subtitle="20 ENEMIES LEFT" showBack>
      <div className="flex h-full w-full items-center gap-4">
        {/* Battle canvas — 416x416 (13 tiles × 32px), driven by GameEngine (T-05) */}
        <GameCanvas onStats={handleStats} />

        {/* HUD sidebar — 224px wide, per PRD 4.2 */}
        <aside className="flex h-canvas w-hud flex-col justify-between p-3 pixel-frame">
          <div>
            <p className="font-pixel text-pixel-sm text-outline">ENEMIES</p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="h-3 w-3 bg-tank-enemyBasic" aria-hidden />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">1P</p>
            <p className="font-pixel text-pixel-lg text-hud-accent">♥♥♥</p>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">STAGE</p>
            <p className="font-pixel text-pixel-2xl text-white">01</p>
          </div>

          {/* Engine diagnostics — T-05 verification */}
          <div className="mt-4 border-t border-outline pt-2">
            <p className="font-pixel text-pixel-sm text-outline">ENGINE</p>
            <p className="font-pixel text-pixel-sm text-white">
              FPS <span className="text-hud-accent">{stats.fps.toString().padStart(2, '0')}</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              UPS <span className="text-hud-accent">{stats.ups.toString().padStart(2, '0')}</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              DT <span className="text-hud-accent">{stats.frameMs.toFixed(1)}ms</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              T <span className="text-hud-accent">{stats.time.toFixed(0)}s</span>
            </p>
          </div>

          <p className="mt-2 animate-blink font-pixel text-pixel-sm text-hud-accent">READY?</p>
        </aside>
      </div>
    </StageLayout>
  )
}
