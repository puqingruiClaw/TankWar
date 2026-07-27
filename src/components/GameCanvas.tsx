/**
 * GameCanvas —— React 侧的画布外壳。
 *
 * T-10 起接入 SpawnManager + 敌军坦克数组；T-11 起接入 AISystem，
 * 敌军移动改由 [stepEnemyAI](../game/systems/AISystem.ts#L95-L123) 输出意图 +
 * [updateTank](../game/systems/MovementSystem.ts#L136-L162) 执行，敌军开火受
 * [canTankFire](../game/entities/Bullet.ts) 与 [ENEMY_MAX_BULLETS](../game/constants.ts#L115) 双重限制。
 *
 * T-12 起接入结算/切关：GameCanvas 内部维护一份"跨关会话状态"
 * [sessionRef](#L163-L169)（lives / score / killByKind），
 * 通过 [onScoreChange](#L67-L73) 与 [onLivesChange](#L74-L79) 冒泡给 HUD；
 * 玩家阵亡走 [respawnPlayer](#L226-L248) 复活，命归零则 emit
 * [onGameOver](#L83-L86)；20 台全灭且场上无敌军则 emit
 * [onStageCleared](#L87-L91)。基地爆破后延迟
 * [GAME_OVER_DELAY](../game/constants.ts#L227-L227) 秒发 onGameOver。
 *
 *   Layer1 底 + 静态地形（brick/steel/water/ice/base）
 * → Layer2 玩家坦克 + 敌军坦克 + 子弹 + 爆炸
 * → Layer3 grass（在坦克之上，实现红白机原版「草丛遮蔽」）
 *
 * 事件（新增于 T-12）：
 * - `onScoreChange`：击杀累计得分变更。
 * - `onLivesChange`：玩家剩余生命变更（含 respawn 后回升）。
 * - `onStageCleared({ killByKind, score })`：本关达成结算条件。
 * - `onGameOver({ reason })`：基地毁 or 玩家 0 命。
 *
 * `phase` prop：由 PlayPage 传入的顶层场景阶段 —— 'playing' 之外的阶段
 * canvas 停帧（engine.pause()），保证 stage-clear/game-over 覆盖层期间世界静止。
 *
 * 输入：↑↓←→ / WASD 移动，Space 开火（PLAYER_MAX_BULLETS 上限），Esc 切 pause/resume。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BASE_POSITION,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ENEMY_MAX_BULLETS,
  GAME_OVER_DELAY,
  PLAYER_INITIAL_LIVES,
  PLAYER_MAX_BULLETS,
  PLAYER_RESPAWN_INVULNERABLE,
  SCORE_TABLE,
  TANK_COOLDOWN,
} from '@/game/constants'
import { canTankFire, createBullet } from '@/game/entities/Bullet'
import { createPlayerTank, isEnemyTank } from '@/game/entities/Tank'
import { DEFAULT_LEVEL } from '@/game/maps/levels'
import { pruneAIMemory, resetAIMemory, stepEnemyAI } from '@/game/systems/AISystem'
import {
  countAliveBulletsByOwner,
  pruneDeadBullets,
  stepBullets,
} from '@/game/systems/CollisionSystem'
import { updateTank } from '@/game/systems/MovementSystem'
import { RenderSystem } from '@/game/systems/RenderSystem'
import { SpawnManager, countAliveEnemies, pruneDeadEnemies } from '@/game/systems/SpawnManager'
import { createRng } from '@/game/utils/rng'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useKeyboard } from '@/hooks/useKeyboard'
import { tileTypeAt } from '@/game/utils/grid'
import type { EngineStats } from '@/game/GameEngine'
import type {
  Bullet,
  EnemyKind,
  EntityId,
  Explosion,
  InputIntent,
  LevelDefinition,
  Tank,
} from '@/game/types'

/** 关卡结算时向外冒泡的击杀分类计数。key 与 [EnemyKind](../game/types.ts#L55-L55) 对齐。 */
export type KillByKind = Record<EnemyKind, number>

export type GameOverReason = 'base-destroyed' | 'lives-exhausted'

interface GameCanvasProps {
  onStats?: (stats: EngineStats) => void
  onInput?: (intent: InputIntent) => void
  onPauseChange?: (paused: boolean) => void
  /** 观察玩家坦克数据（HUD 用），每帧最多推一次。 */
  onTankChange?: (tank: Tank) => void
  /** 观察子弹阵列长度（HUD 用），供显示"存活 / MAX"。 */
  onBulletsChange?: (aliveCount: number, max: number) => void
  /** 敌军数量变化：field 当前场上、queue 剩余待刷、totalSpawned 累计已刷。 */
  onEnemiesChange?: (info: { field: number; queue: number; totalSpawned: number }) => void
  /** 基地被击中：调用方切 game-over 场景。T-12 起 GameCanvas 会延迟发 onGameOver。 */
  onBaseHit?: () => void
  /** 累计得分（跨关叠加，直到整局重开）。 */
  onScoreChange?: (score: number) => void
  /** 玩家剩余生命（含当前场上正在使用的这条）。 */
  onLivesChange?: (lives: number) => void
  /** 达成通关条件：本关 20 台敌军全灭（含队列耗尽）。 */
  onStageCleared?: (info: { killByKind: KillByKind; score: number; stageId: number }) => void
  /** 结束一局：基地被毁 or lives 归零。 */
  onGameOver?: (info: { reason: GameOverReason; score: number; stageId: number }) => void
  /**
   * 顶层场景阶段。'playing' 才推进世界；其余（stage-clear/game-over/paused/intro）冻结。
   * 默认 'playing'，保持 T-11 及之前的行为不变。
   */
  phase?: 'playing' | 'paused' | 'stage-clear' | 'game-over' | 'stage-intro'
  /**
   * 触发"整局重开"的计数器。任意值变化都会重置 sessionRef（生命/得分/击杀分类）。
   * 关卡内切换（stage 递增）**不要**动这个 key，否则 lives/score 会被清零。
   */
  resetSessionKey?: number
  /** 关卡定义；默认使用 STAGE 01（T-07 内置首关）。 */
  level?: LevelDefinition
  /** 显示 tile 网格线（调试用）；默认 false。 */
  showGrid?: boolean
  className?: string
}

/** 爆炸单帧持续 0.1s，共 3 帧 = 0.3s。 */
const EXPLOSION_TTL = 0.3
const EXPLOSION_FRAME_DURATION = EXPLOSION_TTL / 3

/**
 * 每帧组合 player+enemies 用的复用数组。放到 module scope 是为了避免
 * 在 hot path（onUpdate 每秒 60 次、内部还被 spawn/stepBullets 调用两次）
 * 反复 new Array 引发 GC 抖动；GameCanvas 单实例挂载，因此可安全共享。
 */
const scratchTanks: Tank[] = []

function emptyKillByKind(): KillByKind {
  return { basic: 0, fast: 0, power: 0, armor: 0 }
}

/** 生成一次爆炸；`kind='tank'` 时半径更大。 */
function spawnExplosion(
  list: Explosion[],
  nextId: () => EntityId,
  x: number,
  y: number,
  kind: 'bullet' | 'tank',
): void {
  const size = kind === 'tank' ? 32 : 16
  list.push({
    id: nextId(),
    dir: 'up',
    alive: true,
    x: x - size / 2,
    y: y - size / 2,
    w: size,
    h: size,
    ttl: EXPLOSION_TTL,
    frame: 0,
  })
}

function stepExplosions(list: Explosion[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]
    e.ttl -= dt
    if (e.ttl <= 0) {
      list.splice(i, 1)
      continue
    }
    e.frame = Math.min(2, Math.floor((EXPLOSION_TTL - e.ttl) / EXPLOSION_FRAME_DURATION))
  }
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.fillStyle = '#e6e62e'
  ctx.font = '24px "Press Start 2P", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PAUSE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
}

let localExplosionId = 1_000_000

/**
 * 会话级状态：跨关卡持续存在，只在 [resetSessionKey](#L100-L104) 变更时清零。
 * 生命初始 = PLAYER_INITIAL_LIVES；每次击杀累加 score 与 killByKind。
 */
interface SessionState {
  lives: number
  score: number
  killByKind: KillByKind
  /** 本关首帧后置为 true；stage-clear 判定需要"曾经 spawn 过至少 1 只"才算数。 */
  stageStarted: boolean
  /** stage-clear 是否已发过 —— 防止重复回调。 */
  stageClearFired: boolean
  /** game-over 是否已发过 —— 防止重复回调。 */
  gameOverFired: boolean
  /** 基地被毁后的倒计时（>0 表示已进入"等 GAME_OVER_DELAY 秒发 game-over"状态）。 */
  gameOverCountdown: number
}

function createInitialSession(): SessionState {
  return {
    lives: PLAYER_INITIAL_LIVES,
    score: 0,
    killByKind: emptyKillByKind(),
    stageStarted: false,
    stageClearFired: false,
    gameOverFired: false,
    gameOverCountdown: 0,
  }
}

export default function GameCanvas({
  onStats,
  onInput,
  onPauseChange,
  onTankChange,
  onBulletsChange,
  onEnemiesChange,
  onBaseHit,
  onScoreChange,
  onLivesChange,
  onStageCleared,
  onGameOver,
  phase = 'playing',
  resetSessionKey = 0,
  level = DEFAULT_LEVEL,
  showGrid = false,
  className,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const input = useKeyboard()
  const renderSystem = useMemo(() => new RenderSystem({ showGrid }), [showGrid])
  const tankRef = useRef<Tank>(createPlayerTank())
  const enemiesRef = useRef<Tank[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const explosionsRef = useRef<Explosion[]>([])
  // 关卡地图会被子弹击中砖块修改，因此需要深拷贝一份到 ref。
  const mapRef = useRef<LevelDefinition['map']>(level.map.map((row) => [...row]))
  const spawnerRef = useRef<SpawnManager>(new SpawnManager({ queue: level.enemyQueue }))
  const rngRef = useRef(createRng())
  const sessionRef = useRef<SessionState>(createInitialSession())
  const [paused, setPaused] = useState(false)
  const lastIntentRef = useRef<InputIntent>({ dir: null, fire: false, pausePressed: false })

  /** 回调统一 ref 化：避免 onUpdate 闭包捕获旧的回调，且不必写入 deps 数组。 */
  const callbacksRef = useRef({
    onBaseHit,
    onScoreChange,
    onLivesChange,
    onStageCleared,
    onGameOver,
  })
  useEffect(() => {
    callbacksRef.current = {
      onBaseHit,
      onScoreChange,
      onLivesChange,
      onStageCleared,
      onGameOver,
    }
  }, [onBaseHit, onScoreChange, onLivesChange, onStageCleared, onGameOver])

  /**
   * 复活玩家：把 tankRef 换成"新出生的玩家坦克"，保留 id 演进（不是必须，
   * 但避免 bullets 里的 ownerId 引用到旧 id 造成的偶发 owner 匹配失效）。
   * 出生保护 = PLAYER_RESPAWN_INVULNERABLE，比正常出生略长，防止 spawn point 被围杀。
   */
  const respawnPlayer = useCallback(() => {
    tankRef.current = createPlayerTank({ invulnerable: PLAYER_RESPAWN_INVULNERABLE })
  }, [])

  /**
   * 整局重开：清空 sessionRef，同时清空世界（enemies/bullets/explosions/AI 记忆），
   * 重新深拷贝一份地图，重建 SpawnManager，复活玩家。
   */
  const hardResetWorld = useCallback(() => {
    sessionRef.current = createInitialSession()
    enemiesRef.current = []
    bulletsRef.current = []
    explosionsRef.current = []
    mapRef.current = level.map.map((row) => [...row])
    spawnerRef.current = new SpawnManager({ queue: level.enemyQueue })
    resetAIMemory()
    respawnPlayer()
  }, [level, respawnPlayer])

  /**
   * 单关重开：session（生命/得分）保留，只重置本关的世界状态。
   * 用于 stage-clear → 下一关、或首次挂载时用 level 触发一次。
   */
  const softResetForLevel = useCallback(() => {
    enemiesRef.current = []
    bulletsRef.current = []
    explosionsRef.current = []
    mapRef.current = level.map.map((row) => [...row])
    spawnerRef.current = new SpawnManager({ queue: level.enemyQueue })
    resetAIMemory()
    respawnPlayer()
    const s = sessionRef.current
    s.stageStarted = false
    s.stageClearFired = false
    s.gameOverCountdown = 0
    // gameOverFired 保持：整局层面它由 hardResetWorld 清；这里只重置本关标志。
  }, [level, respawnPlayer])

  // 整局重开：resetSessionKey 变化时触发；关卡内切关不进入此分支。
  useEffect(() => {
    hardResetWorld()
    callbacksRef.current.onLivesChange?.(sessionRef.current.lives)
    callbacksRef.current.onScoreChange?.(sessionRef.current.score)
    onEnemiesChange?.({ field: 0, queue: level.enemyQueue.length, totalSpawned: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSessionKey])

  // 切关卡（level 变化）：软重置世界，保留 session。
  useEffect(() => {
    softResetForLevel()
    onEnemiesChange?.({ field: 0, queue: level.enemyQueue.length, totalSpawned: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const { engine, stats } = useGameLoop(canvasRef, {
    onUpdate: (dt) => {
      const intent = input.getIntent()
      const fireEdge = input.consumeFireEdge()

      const tank = tankRef.current
      const enemies = enemiesRef.current
      const bullets = bulletsRef.current
      const explosions = explosionsRef.current
      const map = mapRef.current
      const rng = rngRef.current
      const session = sessionRef.current

      // 1) 玩家推进
      updateTank(map, tank, dt, { intent })

      // 2) 玩家开火：受冷却 + PLAYER_MAX_BULLETS 双重限制。
      if (fireEdge && tank.alive && canTankFire(tank)) {
        const owned = countAliveBulletsByOwner(bullets, tank.id)
        if (owned < PLAYER_MAX_BULLETS) {
          bullets.push(createBullet(tank))
          tank.cooldown = TANK_COOLDOWN.PLAYER
        }
      }

      // 3) 敌军刷新（受 MAX_ENEMIES_ON_FIELD + 出生点占用 限制）
      const spawnResult = spawnerRef.current.step({
        map,
        tanks: refreshScratchTanks(enemies, tank),
        dt,
      })
      if (spawnResult.spawned.length > 0) {
        enemies.push(...spawnResult.spawned)
        session.stageStarted = true
      }

      // 4) 敌军 AI：FSM 决策 → 移动 + 开火（T-11）
      const isBaseAlive = tileTypeAt(map, BASE_POSITION.col, BASE_POSITION.row) === 'base'
      const aliveEnemyIds = new Set<EntityId>()
      for (const e of enemies) {
        if (!e.alive) continue
        aliveEnemyIds.add(e.id)
        const aiIntent = stepEnemyAI(map, e, dt, {
          player: tank,
          basePos: isBaseAlive ? BASE_POSITION : null,
          nextRandom: () => rng.next(),
        })
        updateTank(map, e, dt, { forcedDir: aiIntent.desiredDir })
        if (aiIntent.wantFire && canTankFire(e)) {
          const owned = countAliveBulletsByOwner(bullets, e.id)
          if (owned < ENEMY_MAX_BULLETS) {
            bullets.push(createBullet(e))
            e.cooldown = TANK_COOLDOWN.ENEMY
          }
        }
      }
      pruneAIMemory(aliveEnemyIds)

      // 5) 推进子弹 & 命中判定。
      //    T-12 起接入 onEnemyKilled / onPlayerKilled：
      //    - 敌军死亡 → 累加 score + killByKind
      //    - 玩家死亡 → lives--，若还有命则下一帧 respawn；若归零则倒计时 game-over
      stepBullets({
        map,
        bullets,
        tanks: refreshScratchTanks(enemies, tank),
        dt,
        events: {
          onExplosion: (x, y, kind) =>
            spawnExplosion(explosions, () => ++localExplosionId, x, y, kind),
          onBaseHit: () => {
            callbacksRef.current.onBaseHit?.()
            // 基地爆破：延迟 GAME_OVER_DELAY 秒发 game-over，让爆炸有时间演出。
            if (session.gameOverCountdown <= 0) session.gameOverCountdown = GAME_OVER_DELAY
          },
          onEnemyKilled: (killed) => {
            if (!isEnemyTank(killed)) return
            const kind = killed.kind as EnemyKind
            session.killByKind[kind] = (session.killByKind[kind] ?? 0) + 1
            session.score += SCORE_TABLE[kind]
            callbacksRef.current.onScoreChange?.(session.score)
          },
          onPlayerKilled: () => {
            session.lives = Math.max(0, session.lives - 1)
            callbacksRef.current.onLivesChange?.(session.lives)
            if (session.lives > 0) {
              respawnPlayer()
            } else if (!session.gameOverFired && session.gameOverCountdown <= 0) {
              // 玩家 0 命：立即（下一帧）触发 game-over。
              session.gameOverCountdown = GAME_OVER_DELAY
            }
          },
        },
      })
      pruneDeadBullets(bullets)
      pruneDeadEnemies(enemies)
      stepExplosions(explosions, dt)

      // 6) 终局判定 —— 每帧检查一次，防止漏发。
      //    stage-clear：本关队列耗尽 + 场上无存活敌军 + session.stageStarted。
      if (
        !session.stageClearFired &&
        session.stageStarted &&
        spawnerRef.current.isQueueDrained() &&
        countAliveEnemies(enemies) === 0
      ) {
        session.stageClearFired = true
        callbacksRef.current.onStageCleared?.({
          killByKind: { ...session.killByKind },
          score: session.score,
          stageId: level.id,
        })
      }

      //    game-over：基地爆破 or 玩家 0 命触发倒计时；倒计时归零 → emit。
      if (session.gameOverCountdown > 0) {
        session.gameOverCountdown = Math.max(0, session.gameOverCountdown - dt)
        if (session.gameOverCountdown <= 0 && !session.gameOverFired) {
          session.gameOverFired = true
          const reason: GameOverReason = isBaseAlive ? 'lives-exhausted' : 'base-destroyed'
          callbacksRef.current.onGameOver?.({
            reason,
            score: session.score,
            stageId: level.id,
          })
        }
      }

      lastIntentRef.current = intent
    },
    onRender: (ctx) => {
      // pause 边沿在 render 路径处理：即使 engine 被 pause，render 仍会执行，
      // 才能保证 Esc 既能暂停也能恢复。
      if (input.consumePauseEdge()) {
        if (engine.isPaused()) engine.resume()
        else engine.pause()
        const next = engine.isPaused()
        setPaused(next)
        onPauseChange?.(next)
      }

      const map = mapRef.current

      // Layer 1: 底 + 静态地形
      renderSystem.drawBackground(ctx)
      renderSystem.drawTerrainBelow(ctx, map)

      // Layer 2: 玩家 + 敌军 + 子弹 + 爆炸
      renderSystem.drawTank(ctx, tankRef.current)
      for (const e of enemiesRef.current) renderSystem.drawTank(ctx, e)
      for (const b of bulletsRef.current) renderSystem.drawBullet(ctx, b)
      for (const e of explosionsRef.current) renderSystem.drawExplosion(ctx, e)

      // Layer 3: grass（在坦克之上）
      renderSystem.drawTerrainAbove(ctx, map)

      if (engine.isPaused()) drawPauseOverlay(ctx)
    },
  })

  // 外部 phase → 引擎 pause/resume 联动：
  // - 'playing' 之外的所有阶段都停帧，让 stage-clear / game-over 覆盖层期间世界静止；
  // - 但不去改 setPaused（那是 ESC 语义的 UI 反馈），避免 HUD 突然写 PAUSED。
  useEffect(() => {
    if (phase === 'playing') {
      if (engine.isPaused()) engine.resume()
    } else if (!engine.isPaused()) {
      engine.pause()
    }
  }, [phase, engine])

  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  useEffect(() => {
    if (!onInput && !onTankChange && !onBulletsChange && !onEnemiesChange) return
    const id = window.setInterval(() => {
      onInput?.(lastIntentRef.current)
      onTankChange?.(tankRef.current)
      if (onBulletsChange) {
        const alive = countAliveBulletsByOwner(bulletsRef.current, tankRef.current.id)
        onBulletsChange(alive, PLAYER_MAX_BULLETS)
      }
      if (onEnemiesChange) {
        const field = countAliveEnemies(enemiesRef.current)
        const queue = spawnerRef.current.queueLength()
        onEnemiesChange({
          field,
          queue,
          totalSpawned: spawnerRef.current.totalSpawnedCount(),
        })
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [onInput, onTankChange, onBulletsChange, onEnemiesChange])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className={'pixelated block border-2 border-outline bg-black ' + (className ?? '')}
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      aria-label="Battle canvas"
      data-paused={paused}
    />
  )
}

/**
 * 用 module-scope 的 [scratchTanks](#L120-L120)
 * 复用同一个数组来组合 enemies + player：
 * - 清空后按 (enemies..., player) 顺序 push；
 * - 返回同一引用，调用方**只在本帧同步使用**，不得跨帧持有。
 * 单实例前提下不会有并发写；如果未来引入多 GameCanvas，需要改成实例级 ref。
 */
function refreshScratchTanks(enemies: readonly Tank[], player: Tank): Tank[] {
  scratchTanks.length = 0
  for (let i = 0; i < enemies.length; i++) scratchTanks.push(enemies[i])
  scratchTanks.push(player)
  return scratchTanks
}
