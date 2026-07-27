/**
 * GameCanvas —— React 侧的画布外壳。
 *
 * T-10 起接入 SpawnManager + 敌军坦克数组：
 *   Layer1 底 + 静态地形（brick/steel/water/ice/base）
 * → Layer2 玩家坦克 + 敌军坦克 + 子弹 + 爆炸
 * → Layer3 grass（在坦克之上，实现红白机原版「草丛遮蔽」）
 *
 * 事件：
 * - `onBaseHit`：基地被击中 → PlayPage 切 game-over 提示（T-12 会做完整场景）。
 * - `onEnemiesChange`：场上/剩余敌军数变化时冒泡给 HUD。
 * 输入：↑↓←→ / WASD 移动，Space 开火（PLAYER_MAX_BULLETS 上限），Esc 切 pause/resume。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, PLAYER_MAX_BULLETS, TANK_COOLDOWN } from '@/game/constants'
import { canTankFire, createBullet } from '@/game/entities/Bullet'
import { createPlayerTank } from '@/game/entities/Tank'
import { DEFAULT_LEVEL } from '@/game/maps/levels'
import {
  countAliveBulletsByOwner,
  pruneDeadBullets,
  stepBullets,
} from '@/game/systems/CollisionSystem'
import { stepEnemyPatrol, updateTank } from '@/game/systems/MovementSystem'
import { RenderSystem } from '@/game/systems/RenderSystem'
import { SpawnManager, countAliveEnemies, pruneDeadEnemies } from '@/game/systems/SpawnManager'
import { createRng } from '@/game/utils/rng'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { EngineStats } from '@/game/GameEngine'
import type {
  Bullet,
  Direction,
  EntityId,
  Explosion,
  InputIntent,
  LevelDefinition,
  Tank,
} from '@/game/types'

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
  /** 基地被击中：调用方切 game-over 场景（T-12）。目前只做视觉提示。 */
  onBaseHit?: () => void
  /** 关卡定义；默认使用 STAGE 01（T-07 内置首关）。 */
  level?: LevelDefinition
  /** 显示 tile 网格线（调试用）；默认 false。 */
  showGrid?: boolean
  className?: string
}

/** 爆炸单帧持续 0.1s，共 3 帧 = 0.3s。 */
const EXPLOSION_TTL = 0.3
const EXPLOSION_FRAME_DURATION = EXPLOSION_TTL / 3

const DIR_POOL: Direction[] = ['up', 'down', 'left', 'right']

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

export default function GameCanvas({
  onStats,
  onInput,
  onPauseChange,
  onTankChange,
  onBulletsChange,
  onEnemiesChange,
  onBaseHit,
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
  const [paused, setPaused] = useState(false)
  const lastIntentRef = useRef<InputIntent>({ dir: null, fire: false, pausePressed: false })

  // 切关卡时重置所有动态实体 + 深拷贝地图 + 新建 SpawnManager。
  useEffect(() => {
    tankRef.current = createPlayerTank()
    enemiesRef.current = []
    bulletsRef.current = []
    explosionsRef.current = []
    mapRef.current = level.map.map((row) => [...row])
    spawnerRef.current = new SpawnManager({ queue: level.enemyQueue })
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

      // 1) 玩家推进
      updateTank(map, tank, dt, { intent })

      // 2) 玩家开火：受冷却 + PLAYER_MAX_BULLETS 双重限制。
      if (fireEdge && canTankFire(tank)) {
        const owned = countAliveBulletsByOwner(bullets, tank.id)
        if (owned < PLAYER_MAX_BULLETS) {
          bullets.push(createBullet(tank))
          tank.cooldown = TANK_COOLDOWN.PLAYER
        }
      }

      // 3) 敌军刷新（受 MAX_ENEMIES_ON_FIELD + 出生点占用 限制）
      const spawnResult = spawnerRef.current.step({ map, tanks: enemyAndPlayer(enemies, tank), dt })
      if (spawnResult.spawned.length > 0) enemies.push(...spawnResult.spawned)

      // 4) 敌军移动（T-10 用最小巡逻 AI 占位；T-11 会替换为正式 AI）
      for (const e of enemies) {
        if (!e.alive) continue
        stepEnemyPatrol(map, e, dt, () => DIR_POOL[Math.floor(rng.next() * DIR_POOL.length)])
      }

      // 5) 推进子弹 & 命中判定；敌军作为可命中目标一起传入。
      stepBullets({
        map,
        bullets,
        tanks: enemyAndPlayer(enemies, tank),
        dt,
        events: {
          onExplosion: (x, y, kind) =>
            spawnExplosion(explosions, () => ++localExplosionId, x, y, kind),
          onBaseHit: () => onBaseHit?.(),
        },
      })
      pruneDeadBullets(bullets)
      pruneDeadEnemies(enemies)
      stepExplosions(explosions, dt)

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
 * 组合 enemies + player 为一个只读数组，避免每帧手动拼接。
 * 复用一个数组常量能省掉极小的分配开销，但更重要的是让"传给 System 的 tanks
 * 语义"集中在一个地方，看代码时不会漏。
 */
function enemyAndPlayer(enemies: Tank[], player: Tank): Tank[] {
  const arr = new Array<Tank>(enemies.length + 1)
  for (let i = 0; i < enemies.length; i++) arr[i] = enemies[i]
  arr[enemies.length] = player
  return arr
}
