/**
 * GameCanvas —— React 侧的画布外壳。
 *
 * T-07 起挂载 RenderSystem 并渲染 STAGE 01 关卡地形：底层砖/钢/水/冰/base
 * → 玩家演示方块（键盘驱动）+ 空格粒子 → 上层 grass（覆盖玩家实现「隐蔽」
 * 效果）。真正的坦克、子弹、碰撞在 T-08+ 接入，届时替换 update/render 回调。
 * 通过 `disableDemo` 可以关掉演示层，仅保留地形。
 *
 * 输入：↑↓←→ / WASD 移动，Space 开火（视觉粒子），Esc 切 pause/resume。
 * 交由 InputSystem（T-06）解析，本组件只消费 `intent` 与 edge 通道。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, PALETTE, TANK_SPEED, TILE_SIZE } from '@/game/constants'
import { DEFAULT_LEVEL } from '@/game/maps/levels'
import { RenderSystem } from '@/game/systems/RenderSystem'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { EngineStats } from '@/game/GameEngine'
import type { Direction, InputIntent, LevelDefinition } from '@/game/types'

interface GameCanvasProps {
  onStats?: (stats: EngineStats) => void
  onInput?: (intent: InputIntent) => void
  onPauseChange?: (paused: boolean) => void
  /** 关卡定义；默认使用 STAGE 01（T-07 内置首关）。 */
  level?: LevelDefinition
  /** 关闭玩家演示方块，仅渲染地形；默认 false。 */
  disableDemo?: boolean
  /** 显示 tile 网格线（调试用）；默认 false。 */
  showGrid?: boolean
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

interface DemoState {
  x: number
  y: number
  facing: Direction
  particles: Particle[]
}

const PARTICLE_LIFE = 0.35
const PARTICLE_SPEED = 220
const PARTICLE_SIZE = 6

const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** 经典 BC 1P 出生点：底行左三分之一。 */
const PLAYER_SPAWN = { col: 4, row: 12 }

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function stepDemo(state: DemoState, intent: InputIntent, dt: number): void {
  const speed = TANK_SPEED.PLAYER
  const maxX = CANVAS_WIDTH - TILE_SIZE
  const maxY = CANVAS_HEIGHT - TILE_SIZE

  if (intent.dir) {
    state.facing = intent.dir
    const v = DIR_VECTORS[intent.dir]
    state.x = clamp(state.x + v.x * speed * dt, 0, maxX)
    state.y = clamp(state.y + v.y * speed * dt, 0, maxY)
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.life -= dt
    if (p.life <= 0) {
      state.particles.splice(i, 1)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
}

function spawnParticle(state: DemoState): void {
  const v = DIR_VECTORS[state.facing]
  const originX = state.x + TILE_SIZE / 2 - PARTICLE_SIZE / 2 + v.x * (TILE_SIZE / 2)
  const originY = state.y + TILE_SIZE / 2 - PARTICLE_SIZE / 2 + v.y * (TILE_SIZE / 2)
  state.particles.push({
    x: originX,
    y: originY,
    vx: v.x * PARTICLE_SPEED,
    vy: v.y * PARTICLE_SPEED,
    life: PARTICLE_LIFE,
  })
}

function drawTank(ctx: CanvasRenderingContext2D, state: DemoState): void {
  ctx.fillStyle = PALETTE.tank.player
  ctx.fillRect(state.x, state.y, TILE_SIZE, TILE_SIZE)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.strokeRect(state.x + 1, state.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)

  const v = DIR_VECTORS[state.facing]
  const cx = state.x + TILE_SIZE / 2
  const cy = state.y + TILE_SIZE / 2
  ctx.fillStyle = '#000000'
  ctx.fillRect(cx + v.x * 10 - 3, cy + v.y * 10 - 3, 6, 6)
}

function drawParticles(ctx: CanvasRenderingContext2D, state: DemoState): void {
  ctx.fillStyle = PALETTE.bullet
  for (const p of state.particles) {
    ctx.fillRect(Math.round(p.x), Math.round(p.y), PARTICLE_SIZE, PARTICLE_SIZE)
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

export default function GameCanvas({
  onStats,
  onInput,
  onPauseChange,
  level = DEFAULT_LEVEL,
  disableDemo = false,
  showGrid = false,
  className,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const input = useKeyboard()
  const renderSystem = useMemo(() => new RenderSystem({ showGrid }), [showGrid])
  const demoRef = useRef<DemoState>({
    x: PLAYER_SPAWN.col * TILE_SIZE,
    y: PLAYER_SPAWN.row * TILE_SIZE,
    facing: 'up',
    particles: [],
  })
  const [paused, setPaused] = useState(false)
  const lastIntentRef = useRef<InputIntent>({ dir: null, fire: false, pausePressed: false })

  const { engine, stats } = useGameLoop(canvasRef, {
    onUpdate: (dt) => {
      const intent = input.getIntent()
      const fireEdge = input.consumeFireEdge()

      if (!disableDemo) {
        if (fireEdge) spawnParticle(demoRef.current)
        stepDemo(demoRef.current, intent, dt)
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

      // Layer 1: 底 + 静态地形（brick/steel/water/ice/base）
      renderSystem.drawBackground(ctx)
      renderSystem.drawTerrainBelow(ctx, level.map)

      // Layer 2: 玩家演示方块与子弹粒子
      if (!disableDemo) {
        drawTank(ctx, demoRef.current)
        drawParticles(ctx, demoRef.current)
      }

      // Layer 3: grass（在坦克之上，实现红白机原版「草丛遮蔽」效果）
      renderSystem.drawTerrainAbove(ctx, level.map)

      if (engine.isPaused()) drawPauseOverlay(ctx)
    },
  })

  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  useEffect(() => {
    if (!onInput) return
    const id = window.setInterval(() => onInput(lastIntentRef.current), 100)
    return () => window.clearInterval(id)
  }, [onInput])

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
