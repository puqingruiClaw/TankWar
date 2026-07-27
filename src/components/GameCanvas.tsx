/**
 * GameCanvas —— React 侧的画布外壳。
 *
 * T-06 起接入 InputSystem：把演示方块的自动巡逻替换为「方向键 / WASD 驱动」，
 * 空格触发一枚 8px 白色像素粒子沿当前朝向飞出（生命周期 0.35s，仅用于视觉
 * 验证 fire edge）。Esc 切换引擎 pause/resume，验证 InputSystem 的 pauseEdge。
 *
 * 真正的坦克、子弹、碰撞由后续 T-07 及以后的 System 接管；本组件预留了
 * `disableDemo`，届时父组件通过 props 注入替代 update/render 即可。
 */

import { useEffect, useRef, useState } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, PALETTE, TANK_SPEED, TILE_SIZE } from '@/game/constants'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { EngineStats } from '@/game/GameEngine'
import type { Direction, InputIntent } from '@/game/types'

interface GameCanvasProps {
  onStats?: (stats: EngineStats) => void
  onInput?: (intent: InputIntent) => void
  onPauseChange?: (paused: boolean) => void
  disableDemo?: boolean
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

function drawDemo(ctx: CanvasRenderingContext2D, state: DemoState, paused: boolean): void {
  ctx.fillStyle = PALETTE.stage
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1
  for (let x = TILE_SIZE; x < CANVAS_WIDTH; x += TILE_SIZE) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, CANVAS_HEIGHT)
    ctx.stroke()
  }
  for (let y = TILE_SIZE; y < CANVAS_HEIGHT; y += TILE_SIZE) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(CANVAS_WIDTH, y + 0.5)
    ctx.stroke()
  }

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

  ctx.fillStyle = PALETTE.bullet
  for (const p of state.particles) {
    ctx.fillRect(Math.round(p.x), Math.round(p.y), PARTICLE_SIZE, PARTICLE_SIZE)
  }

  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = '#e6e62e'
    ctx.font = '24px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('PAUSE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
  }
}

export default function GameCanvas({
  onStats,
  onInput,
  onPauseChange,
  disableDemo = false,
  className,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const input = useKeyboard()
  const demoRef = useRef<DemoState>({
    x: CANVAS_WIDTH / 2 - TILE_SIZE / 2,
    y: CANVAS_HEIGHT / 2 - TILE_SIZE / 2,
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

      if (disableDemo) {
        ctx.fillStyle = PALETTE.stage
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        return
      }
      drawDemo(ctx, demoRef.current, engine.isPaused())
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
