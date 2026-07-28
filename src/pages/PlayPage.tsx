import { useCallback, useEffect, useMemo, useState } from 'react'
import StageLayout from '@/layouts/StageLayout'
import GameCanvas, { type GameOverReason, type KillByKind } from '@/components/GameCanvas'
import {
  PLAYER_INITIAL_LIVES,
  PLAYER_MAX_BULLETS,
  POWERUP_CLOCK_DURATION,
  POWERUP_HELMET_DURATION,
  POWERUP_SHOVEL_DURATION,
  SCORE_TABLE,
  STAGE_CLEAR_DURATION,
  STAGE_CLEAR_TICK,
  TANK_COOLDOWN,
  TILE_SIZE,
} from '@/game/constants'
import { DEFAULT_LEVEL, LEVELS, STAGE_HINTS, TOTAL_STAGES } from '@/game/maps/levels'
import type { EngineStats } from '@/game/GameEngine'
import type { InputIntent, LevelDefinition, PowerUpKind, Tank } from '@/game/types'

/**
 * PlayPage —— T-12 起把"单纯战场画布"升级成完整的一局；T-15 起打通
 * 5 关完整流程 + 一周目通关：
 *   playing → stage-clear（结算 + 自动切下一关）↺
 *   playing → stage-clear（末关）→ game-complete（一周目通关庆祝）
 *   playing → game-over（基地毁 or 3 命耗尽，允许 RETRY / 回菜单）
 *
 * 关键状态：
 * - [phase](#L51-L51)：顶层场景阶段。切到非 'playing' 会通知 GameCanvas 冻结世界。
 * - [levelIndex](#L67-L67)：当前关卡在 [LEVELS](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/maps/levels.ts) 里的下标。
 *   stage-clear 后若不是末关则 +1 前进；若是末关则进入 game-complete。
 * - [resetKey](#L69-L69)：整局重开计数器，改变即触发 GameCanvas 清 session。
 *
 * 终局分叉说明（T-15）：
 *   stage-clear 定时器到点，先看 `stageClearInfo.stageId === LEVELS[last].id`：
 *   是 → phase = 'game-complete'（保留 GameCanvas 冻结世界）
 *   否 → levelIndex += 1，phase = 'playing'（GameCanvas 内部 softReset）
 */

type Phase = 'playing' | 'paused' | 'stage-clear' | 'game-over' | 'game-complete'

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

/**
 * T-17：道具 HUD 面板里 6 种 kind 的短标签。
 * 使用大写 3-6 字母，与 SCORE / STAGE 面板的 pixel 字号一致。
 */
const POWERUP_KIND_LABEL: Record<PowerUpKind, string> = {
  star: 'STAR',
  helmet: 'HELMET',
  bomb: 'BOMB',
  shovel: 'SHOVEL',
  clock: 'CLOCK',
  tank: 'TANK',
}

interface StageClearInfo {
  killByKind: KillByKind
  score: number
  stageId: number
}

interface GameOverInfo {
  reason: GameOverReason
  score: number
  stageId: number
}

export default function PlayPage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const level: LevelDefinition = LEVELS[levelIndex] ?? DEFAULT_LEVEL
  const [phase, setPhase] = useState<Phase>('playing')
  const [resetKey, setResetKey] = useState(0)
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
  const [lives, setLives] = useState(PLAYER_INITIAL_LIVES)
  const [score, setScore] = useState(0)
  /**
   * T-17：HUD 面板用的一份"道具状态快照"。
   * - field：场上唯一道具（null 表示无）；
   * - freezeTimer / shovelTimer / helmetTimer：3 类"计时型 buff"的剩余秒；
   * - playerLevel：玩家火力等级（星道具累加）；
   * - collected：本局累计拾取道具数（HUD 展示 & 未来接结算面板）。
   */
  const [powerUp, setPowerUp] = useState<{
    field: { kind: PowerUpKind; lifetime: number } | null
    freezeTimer: number
    shovelTimer: number
    helmetTimer: number
    playerLevel: number
    collected: number
  }>({
    field: null,
    freezeTimer: 0,
    shovelTimer: 0,
    helmetTimer: 0,
    playerLevel: 0,
    collected: 0,
  })
  const [stageClearInfo, setStageClearInfo] = useState<StageClearInfo | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  /**
   * game-complete 面板需要的一份"整局快照"：一周目 5 关全通时 stage-clear
   * 结算面板停在最后一关的数据上，通关面板则展示"最终总分 + 最终关卡编号"，
   * 二者在同一 phase 上会打架，因此各持一份 state。
   */
  const [gameCompleteInfo, setGameCompleteInfo] = useState<{
    finalScore: number
    finalStageId: number
  } | null>(null)

  const handleStats = useCallback((s: EngineStats) => setStats(s), [])
  const handleInput = useCallback((i: InputIntent) => setIntent(i), [])
  const handlePause = useCallback((p: boolean) => {
    setPaused(p)
    // ESC 暂停只影响 UI 提示；phase 保持 'playing'，GameCanvas 内部的 engine.pause() 已经处理停帧。
  }, [])
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
  const handleScore = useCallback((s: number) => setScore(s), [])
  const handleLives = useCallback((l: number) => setLives(l), [])
  const handlePowerUp = useCallback(
    (info: {
      field: { kind: PowerUpKind; lifetime: number } | null
      freezeTimer: number
      shovelTimer: number
      helmetTimer: number
      playerLevel: number
      collected: number
    }) => setPowerUp(info),
    [],
  )
  const handleStageCleared = useCallback((info: StageClearInfo) => {
    setStageClearInfo(info)
    setPhase('stage-clear')
  }, [])
  const handleGameOver = useCallback((info: GameOverInfo) => {
    setGameOverInfo(info)
    setPhase('game-over')
  }, [])

  /**
   * stage-clear：等待 STAGE_CLEAR_DURATION 秒，做一次终局分叉判定：
   * - 若当前是最后一关（levelIndex === LEVELS.length - 1），直接进 game-complete；
   *   注意：这里读的是 levelIndex，而非 stageId，避免"跳关调试"等情况下判错。
   * - 否则：levelIndex +1，phase 回 'playing'；GameCanvas useEffect([level]) 会
   *   自动 softReset（清 enemies/bullets/map，保留 lives/score）。
   */
  useEffect(() => {
    if (phase !== 'stage-clear') return
    const timer = window.setTimeout(() => {
      const isLastStage = levelIndex >= LEVELS.length - 1
      if (isLastStage) {
        setGameCompleteInfo({
          finalScore: score,
          finalStageId: level.id,
        })
        setStageClearInfo(null)
        setPhase('game-complete')
      } else {
        setLevelIndex((idx) => idx + 1)
        setStageClearInfo(null)
        setBaseDown(false)
        setPhase('playing')
      }
    }, STAGE_CLEAR_DURATION * 1000)
    return () => window.clearTimeout(timer)
  }, [phase, levelIndex, score, level.id])

  /** RETRY：整局重开 —— 回到关卡 0，session 清零，phase 归 playing。 */
  const handleRetry = useCallback(() => {
    setLevelIndex(0)
    setResetKey((k) => k + 1)
    setStageClearInfo(null)
    setGameOverInfo(null)
    setGameCompleteInfo(null)
    setBaseDown(false)
    setLives(PLAYER_INITIAL_LIVES)
    setScore(0)
    setPhase('playing')
  }, [])

  const enemiesLeft = enemies.field + enemies.queue
  const subtitle = useMemo(() => {
    if (phase === 'game-complete') return 'MISSION COMPLETE'
    if (phase === 'game-over') return 'GAME OVER'
    if (phase === 'stage-clear') return 'STAGE CLEAR'
    if (baseDown) return 'BASE DESTROYED'
    if (paused) return 'PAUSED'
    return `${enemiesLeft} ENEMIES LEFT`
  }, [phase, baseDown, paused, enemiesLeft])

  const totalEnemies = level.enemyQueue.length
  const spawnedCount = Math.min(totalEnemies, enemies.totalSpawned)
  const tankCol = Math.floor(tank.x / TILE_SIZE)
  const tankRow = Math.floor(tank.y / TILE_SIZE)
  const shieldOn = tank.invulnerable > 0
  const cooldownPct = Math.min(100, Math.round((tank.cooldown / TANK_COOLDOWN.PLAYER) * 100))

  return (
    <StageLayout title={level.name} subtitle={subtitle} showBack>
      <div className="flex h-full w-full items-center gap-4">
        <div className="relative">
          <GameCanvas
            level={level}
            phase={phase}
            resetSessionKey={resetKey}
            onStats={handleStats}
            onInput={handleInput}
            onTankChange={handleTank}
            onPauseChange={handlePause}
            onBulletsChange={handleBullets}
            onEnemiesChange={handleEnemies}
            onBaseHit={handleBaseHit}
            onScoreChange={handleScore}
            onLivesChange={handleLives}
            onPowerUpChange={handlePowerUp}
            onStageCleared={handleStageCleared}
            onGameOver={handleGameOver}
          />

          {phase === 'stage-clear' && stageClearInfo && (
            <StageClearOverlay
              info={stageClearInfo}
              isFinalStage={levelIndex >= LEVELS.length - 1}
            />
          )}
          {phase === 'game-over' && gameOverInfo && (
            <GameOverOverlay info={gameOverInfo} onRetry={handleRetry} />
          )}
          {phase === 'game-complete' && gameCompleteInfo && (
            <GameCompleteOverlay info={gameCompleteInfo} onRetry={handleRetry} />
          )}
        </div>

        <aside className="flex h-canvas w-hud flex-col justify-between p-3 pixel-frame">
          <div>
            <p className="font-pixel text-pixel-sm text-outline">ENEMIES</p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {Array.from({ length: totalEnemies }).map((_, i) => {
                const consumed = i < spawnedCount
                return (
                  <div
                    key={i}
                    className={`h-3 w-3 ${consumed ? 'bg-outline opacity-40' : 'bg-tank-enemyBasic'}`}
                    aria-hidden
                  />
                )
              })}
            </div>
            <p className="mt-2 font-pixel text-pixel-sm text-white">
              FIELD <span className="text-tank-enemyBasic">{enemies.field}</span>
              <span className="ml-2">
                QUEUE <span className="text-hud-accent">{enemies.queue}</span>
              </span>
            </p>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">1P</p>
            <p className="font-pixel text-pixel-lg text-hud-accent">
              {'♥'.repeat(Math.max(lives, 0)) || '·'}
            </p>
            <p className="font-pixel text-pixel-sm text-white">
              LIVES <span className="text-hud-accent">{lives}</span>
            </p>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">SCORE</p>
            <p className="font-pixel text-pixel-2xl text-hud-accent">
              {score.toString().padStart(6, '0')}
            </p>
          </div>

          <div className="mt-4 border-t border-outline pt-2">
            <p className="font-pixel text-pixel-sm text-outline">POWER-UP</p>
            <p className="font-pixel text-pixel-sm text-white">
              FIELD{' '}
              <span className={powerUp.field ? 'animate-blink text-hud-accent' : 'text-outline'}>
                {powerUp.field
                  ? `${POWERUP_KIND_LABEL[powerUp.field.kind]} ${powerUp.field.lifetime.toFixed(1)}s`
                  : '---'}
              </span>
            </p>
            <p className="mt-1 font-pixel text-pixel-sm text-white">
              STAR LV <span className="text-hud-accent">{powerUp.playerLevel}</span>
              <span className="ml-2 text-outline">GOT</span>{' '}
              <span className="text-hud-accent">
                {powerUp.collected.toString().padStart(2, '0')}
              </span>
            </p>
            <BuffBar label="HELMET" seconds={powerUp.helmetTimer} full={POWERUP_HELMET_DURATION} />
            <BuffBar label="CLOCK" seconds={powerUp.freezeTimer} full={POWERUP_CLOCK_DURATION} />
            <BuffBar label="SHOVEL" seconds={powerUp.shovelTimer} full={POWERUP_SHOVEL_DURATION} />
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">STAGE</p>
            <p className="font-pixel text-pixel-2xl text-white">
              {level.id.toString().padStart(2, '0')}
              <span className="ml-2 text-pixel-sm text-outline">
                / {TOTAL_STAGES.toString().padStart(2, '0')}
              </span>
            </p>
            {level.tag && (
              <p className="mt-1 font-pixel text-pixel-sm text-hud-accent">{level.tag}</p>
            )}
            {STAGE_HINTS[level.id] && (
              <p className="mt-1 font-pixel text-pixel-sm text-white leading-snug">
                <span className="text-outline">HINT </span>
                {STAGE_HINTS[level.id]}
              </p>
            )}
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
                {paused ? 'PAUSE' : phase.toUpperCase()}
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

/**
 * StageClearOverlay —— 关卡结算面板。
 *
 * 逐条统计：按 `basic → fast → power → armor` 顺序，每 [STAGE_CLEAR_TICK](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/constants.ts#L233-L233)
 * 秒揭示一行；全部揭示后显示 "TOTAL" 与关卡分数，然后 PlayPage 定时器自动切下一关。
 *
 * T-15：新增 `isFinalStage` —— 末关不再显示 "NEXT STAGE..."，改为
 * "MISSION COMPLETE..." 作为通关前奏；同一 timer 结束后 phase 会切到 game-complete。
 */
function StageClearOverlay({
  info,
  isFinalStage,
}: {
  info: StageClearInfo
  isFinalStage: boolean
}) {
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
      <p className="mt-1 text-pixel-lg text-hud-accent animate-blink">CONGRATULATIONS!</p>
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

/**
 * GameOverOverlay —— 结束一局。
 *
 * 红色 GAME OVER 像素字体 + 分数 + 触发原因 + RETRY / MENU 快捷按钮。
 * RETRY 会触发 [handleRetry](#L117-L124) 整局重开。
 */
function GameOverOverlay({ info, onRetry }: { info: GameOverInfo; onRetry: () => void }) {
  const reasonLabel = info.reason === 'base-destroyed' ? 'YOUR BASE FELL' : 'ALL LIVES LOST'
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 font-pixel text-white">
      <p className="text-pixel-2xl text-tank-enemyArmor">GAME</p>
      <p className="text-pixel-2xl text-tank-enemyArmor">OVER</p>
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

/**
 * GameCompleteOverlay —— 一周目通关庆祝面板（T-15）。
 *
 * 触发条件：末关 stage-clear 计时结束（不是 base 被毁 / 命耗尽）。
 * 展示：MISSION COMPLETE 大字 + 最终分数 + 关卡编号 + REPLAY / MENU；
 * 视觉上与 GameOverOverlay 保持结构一致，只用金色（hud-accent）替代红色，
 * 让"结束"与"通关"通过颜色一眼可辨。REPLAY 复用 handleRetry：回首关 + 清 session。
 */
function GameCompleteOverlay({
  info,
  onRetry,
}: {
  info: { finalScore: number; finalStageId: number }
  onRetry: () => void
}) {
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

/**
 * BuffBar —— T-17 计时型 buff 剩余时间的水平进度条。
 *
 * 3 类 buff（HELMET / CLOCK / SHOVEL）共用同一份 UI：
 * - 左侧固定宽度的名称标签；
 * - 右侧一根像素条，宽度 = seconds / full；
 * - seconds === 0 时进度条完全空、名称标签变暗 —— 让"未激活"与"进行中"一眼可辨。
 */
function BuffBar({ label, seconds, full }: { label: string; seconds: number; full: number }) {
  const on = seconds > 0
  const pct = full > 0 ? Math.max(0, Math.min(100, (seconds / full) * 100)) : 0
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className={`w-14 font-pixel text-pixel-sm ${on ? 'text-hud-accent' : 'text-outline'}`}>
        {label}
      </span>
      <div className="relative h-1 flex-1 bg-outline" aria-hidden>
        <div
          className="h-full bg-hud-accent transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-8 text-right font-pixel text-pixel-sm ${on ? 'text-hud-accent' : 'text-outline'}`}
      >
        {on ? `${seconds.toFixed(1)}s` : '--'}
      </span>
    </div>
  )
}
