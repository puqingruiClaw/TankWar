/**
 * GameCanvas —— React 侧的画布外壳。
 *
 * T-08 起用 [Tank](../game/types.ts#L57-L70) 实体 + [MovementSystem](../game/systems/MovementSystem.ts)
 * 取代 T-06/T-07 的演示方块：
 *   Layer1 底 + 静态地形（brick/steel/water/ice/base）
 * → Layer2 坦克（真正的 Tank，走网格 AABB 碰撞，撞墙即停/滑边）
 * → Layer3 grass（在坦克之上，实现红白机原版「草丛遮蔽」）。
 *
 * 空格开火目前只发白色像素粒子作为视觉反馈——真正的 Bullet 实体 + 破砖判定
 * 在 T-09 接入。
 *
 * 输入：↑↓←→ / WASD 移动，Space 视觉粒子，Esc 切 pause/resume。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, PALETTE, TILE_SIZE } from '@/game/constants'
import { createPlayerTank } from '@/game/entities/Tank'
import { DEFAULT_LEVEL } from '@/game/maps/levels'
import { DIRECTION_VECTORS, updateTank } from '@/game/systems/MovementSystem'
import { RenderSystem } from '@/game/systems/RenderSystem'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { EngineStats } from '@/game/GameEngine'
import type { InputIntent, LevelDefinition, Tank } from '@/game/types'

interface GameCanvasProps {
  onStats?: (stats: EngineStats) => void
  onInput?: (intent: InputIntent) => void
  onPauseChange?: (paused: boolean) => void
  /** 观察玩家坦克数据（HUD 用），每帧最多推一次。 */
  onTankChange?: (tank: Tank) => void
  /** 关卡定义；默认使用 STAGE 01（T-07 内置首关）。 */
  level?: LevelDefinition
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

const PARTICLE_LIFE = 0.35
const PARTICLE_SPEED = 220
const PARTICLE_SIZE = 6

function spawnParticle(tank: Tank, particles: Particle[]): void {
  const v = DIRECTION_VECTORS[tank.dir]
  const originX = tank.x + TILE_SIZE / 2 - PARTICLE_SIZE / 2 + v.x * (TILE_SIZE / 2)
  const originY = tank.y + TILE_SIZE / 2 - PARTICLE_SIZE / 2 + v.y * (TILE_SIZE / 2)
  particles.push({
    x: originX,
    y: originY,
    vx: v.x * PARTICLE_SPEED,
    vy: v.y * PARTICLE_SPEED,
    life: PARTICLE_LIFE,
  })
}

function stepParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    if (p.life <= 0) {
      particles.splice(i, 1)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  ctx.fillStyle = PALETTE.bullet
  for (const p of particles) {
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
  onTankChange,
  level = DEFAULT_LEVEL,
  showGrid = false,
  className,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const input = useKeyboard()
  const renderSystem = useMemo(() => new RenderSystem({ showGrid }), [showGrid])
  // 每次挂载建一辆玩家坦克；切关时会因 level 变化触发。
  const tankRef = useRef<Tank>(createPlayerTank())
  const particlesRef = useRef<Particle[]>([])
  const [paused, setPaused] = useState(false)
  const lastIntentRef = useRef<InputIntent>({ dir: null, fire: false, pausePressed: false })

  // 切关卡时重置玩家坦克到出生点，同时清空粒子。
  useEffect(() => {
    tankRef.current = createPlayerTank()
    particlesRef.current = []
  }, [level])

  const { engine, stats } = useGameLoop(canvasRef, {
    onUpdate: (dt) => {
      const intent = input.getIntent()
      const fireEdge = input.consumeFireEdge()

      const tank = tankRef.current
      updateTank(level.map, tank, dt, { intent })

      if (fireEdge && tank.alive) spawnParticle(tank, particlesRef.current)
      stepParticles(particlesRef.current, dt)

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

      // Layer 2: 玩家坦克 + 临时粒子
      renderSystem.drawTank(ctx, tankRef.current)
      drawParticles(ctx, particlesRef.current)

      // Layer 3: grass（在坦克之上，红白机原版「草丛遮蔽」效果）
      renderSystem.drawTerrainAbove(ctx, level.map)

      if (engine.isPaused()) drawPauseOverlay(ctx)
    },
  })

  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  useEffect(() => {
    if (!onInput && !onTankChange) return
    const id = window.setInterval(() => {
      onInput?.(lastIntentRef.current)
      onTankChange?.(tankRef.current)
    }, 100)
    return () => window.clearInterval(id)
  }, [onInput, onTankChange])

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
