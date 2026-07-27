import { useCallback, useState } from 'react'
import StageLayout from '@/layouts/StageLayout'
import GameCanvas from '@/components/GameCanvas'
import { PLAYER_MAX_BULLETS, TANK_COOLDOWN, TILE_SIZE } from '@/game/constants'
import { DEFAULT_LEVEL } from '@/game/maps/levels'
import type { EngineStats } from '@/game/GameEngine'
import type { InputIntent, Tank } from '@/game/types'

const INITIAL_STATS: EngineStats = { fps: 0, ups: 0, frameMs: 0, time: 0 }
const INITIAL_INTENT: InputIntent = { dir: null, fire: false, pausePressed: false }
const INITIAL_TANK: Pick<Tank, 'x' | 'y' | 'dir' | 'level' | 'hp' | 'invulnerable' | 'cooldown'> = {
  x: 0,
  y: 0,
  dir: 'up',
  level: 0,
  hp: 1,
  invulnerable: 0,
  cooldown: 0,
}

const DIR_LABEL: Record<'up' | 'down' | 'left' | 'right', string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

export default function PlayPage() {
  const level = DEFAULT_LEVEL
  const [stats, setStats] = useState<EngineStats>(INITIAL_STATS)
  const [intent, setIntent] = useState<InputIntent>(INITIAL_INTENT)
  const [tank, setTank] =
    useState<Pick<Tank, 'x' | 'y' | 'dir' | 'level' | 'hp' | 'invulnerable' | 'cooldown'>>(
      INITIAL_TANK,
    )
  const [paused, setPaused] = useState(false)
  const [bulletsAlive, setBulletsAlive] = useState(0)
  const [baseDown, setBaseDown] = useState(false)
  const [enemies, setEnemies] = useState<{ field: number; queue: number; totalSpawned: number }>({
    field: 0,
    queue: level.enemyQueue.length,
    totalSpawned: 0,
  })

  const handleStats = useCallback((s: EngineStats) => setStats(s), [])
  const handleInput = useCallback((i: InputIntent) => setIntent(i), [])
  const handlePause = useCallback((p: boolean) => setPaused(p), [])
  const handleTank = useCallback((t: Tank) => {
    setTank({
      x: t.x,
      y: t.y,
      dir: t.dir,
      level: t.level,
      hp: t.hp,
      invulnerable: t.invulnerable,
      cooldown: t.cooldown,
    })
  }, [])
  const handleBullets = useCallback((alive: number) => setBulletsAlive(alive), [])
  const handleBaseHit = useCallback(() => setBaseDown(true), [])
  const handleEnemies = useCallback(
    (info: { field: number; queue: number; totalSpawned: number }) => setEnemies(info),
    [],
  )

  const enemiesLeft = enemies.field + enemies.queue
  const subtitle = baseDown ? 'BASE DESTROYED' : paused ? 'PAUSED' : `${enemiesLeft} ENEMIES LEFT`
  const tankCol = Math.floor(tank.x / TILE_SIZE)
  const tankRow = Math.floor(tank.y / TILE_SIZE)
  const shieldOn = tank.invulnerable > 0
  const cooldownPct = Math.min(100, Math.round((tank.cooldown / TANK_COOLDOWN.PLAYER) * 100))

  return (
    <StageLayout title={level.name} subtitle={subtitle} showBack>
      <div className="flex h-full w-full items-center gap-4">
        <GameCanvas
          level={level}
          onStats={handleStats}
          onInput={handleInput}
          onTankChange={handleTank}
          onPauseChange={handlePause}
          onBulletsChange={handleBullets}
          onEnemiesChange={handleEnemies}
          onBaseHit={handleBaseHit}
        />

        <aside className="flex h-canvas w-hud flex-col justify-between p-3 pixel-frame">
          <div>
            <p className="font-pixel text-pixel-sm text-outline">ENEMIES</p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {Array.from({ length: enemies.queue }).map((_, i) => (
                <div key={i} className="h-3 w-3 bg-tank-enemyBasic" aria-hidden />
              ))}
            </div>
            <p className="mt-2 font-pixel text-pixel-sm text-white">
              FIELD <span className="text-hud-accent">{enemies.field}</span>
              <span className="ml-2">
                QUEUE <span className="text-hud-accent">{enemies.queue}</span>
              </span>
            </p>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">1P</p>
            <p className="font-pixel text-pixel-lg text-hud-accent">
              {'♥'.repeat(Math.max(tank.hp, 0)) || '·'}
            </p>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">STAGE</p>
            <p className="font-pixel text-pixel-2xl text-white">
              {level.id.toString().padStart(2, '0')}
            </p>
          </div>

          <div className="mt-4 border-t border-outline pt-2">
            <p className="font-pixel text-pixel-sm text-outline">TANK</p>
            <p className="font-pixel text-pixel-sm text-white">
              POS{' '}
              <span className="text-hud-accent">
                {tankCol.toString().padStart(2, '0')},{tankRow.toString().padStart(2, '0')}
              </span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              FACE <span className="text-hud-accent">{DIR_LABEL[tank.dir]}</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              LV <span className="text-hud-accent">{tank.level}</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              SHIELD{' '}
              <span className={shieldOn ? 'animate-blink text-hud-accent' : 'text-outline'}>
                {shieldOn ? `${tank.invulnerable.toFixed(1)}s` : 'OFF'}
              </span>
            </p>
          </div>

          <div className="mt-4 border-t border-outline pt-2">
            <p className="font-pixel text-pixel-sm text-outline">BULLETS</p>
            <p className="font-pixel text-pixel-sm text-white">
              LIVE{' '}
              <span className="text-hud-accent">
                {bulletsAlive}/{PLAYER_MAX_BULLETS}
              </span>
            </p>
            <div className="mt-1 h-1 w-full bg-outline" aria-hidden>
              <div
                className="h-full bg-hud-accent transition-[width] duration-75"
                style={{ width: `${100 - cooldownPct}%` }}
              />
            </div>
            <p className="mt-1 font-pixel text-pixel-sm text-white">
              CD <span className="text-hud-accent">{tank.cooldown.toFixed(2)}s</span>
            </p>
          </div>

          <div className="mt-4 border-t border-outline pt-2">
            <p className="font-pixel text-pixel-sm text-outline">BASE</p>
            <p className="font-pixel text-pixel-sm text-white">
              STATUS{' '}
              <span className={baseDown ? 'animate-blink text-hud-accent' : 'text-white'}>
                {baseDown ? 'DESTROYED' : 'OK'}
              </span>
            </p>
          </div>

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

          <div className="mt-2 border-t border-outline pt-2">
            <p className="font-pixel text-pixel-sm text-outline">INPUT</p>
            <p className="font-pixel text-pixel-sm text-white">
              DIR{' '}
              <span className="text-hud-accent">{intent.dir ? DIR_LABEL[intent.dir] : '·'}</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              FIRE <span className="text-hud-accent">{intent.fire ? 'ON' : '··'}</span>
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              STATE{' '}
              <span className={paused ? 'text-hud-accent' : 'text-white'}>
                {paused ? 'PAUSE' : 'RUN'}
              </span>
            </p>
          </div>

          <p className="mt-2 animate-blink font-pixel text-pixel-sm text-hud-accent">
            {paused ? 'ESC=RESUME' : 'ESC=PAUSE'}
          </p>
        </aside>
      </div>
    </StageLayout>
  )
}
