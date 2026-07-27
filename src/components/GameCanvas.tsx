/**
 * GameCanvas —— React 侧的画布外壳。
 *
 * 本组件目前只做两件事：
 * 1. 提供一个尺寸 = CANVAS_WIDTH × CANVAS_HEIGHT 的 `<canvas>`。
 * 2. 通过 {@link useGameLoop} 挂载 GameEngine 主循环，并绑定演示级
 *    update/render 回调，用于肉眼验证 60 FPS 与 dt 稳定。
 *
 * T-06 起会由父组件通过 props 注入真正的 System 组合，届时演示回调删除。
 */

import { useEffect, useRef } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, PALETTE, TANK_SPEED, TILE_SIZE } from '@/game/constants'
import { useGameLoop } from '@/hooks/useGameLoop'
import type { EngineStats } from '@/game/GameEngine'

interface GameCanvasProps {
  /** 当引擎每秒结算 stats 时回调，供父组件展示 HUD。*/
  onStats?: (stats: EngineStats) => void
  /** 关闭调试演示（默认开启：显示一个沿边框绕圈的黄色方块）。*/
  disableDemo?: boolean
  className?: string
}

/** 演示状态：一个 32×32 的黄色方块沿画布内边框顺时针巡逻。*/
interface DemoState {
  x: number
  y: number
  dir: 0 | 1 | 2 | 3
}

function stepDemo(state: DemoState, dt: number): void {
  const speed = TANK_SPEED.PLAYER
  const minX = 0
  const minY = 0
  const maxX = CANVAS_WIDTH - TILE_SIZE
  const maxY = CANVAS_HEIGHT - TILE_SIZE
  switch (state.dir) {
    case 0: // right
      state.x += speed * dt
      if (state.x >= maxX) {
        state.x = maxX
        state.dir = 1
      }
      break
    case 1: // down
      state.y += speed * dt
      if (state.y >= maxY) {
        state.y = maxY
        state.dir = 2
      }
      break
    case 2: // left
      state.x -= speed * dt
      if (state.x <= minX) {
        state.x = minX
        state.dir = 3
      }
      break
    case 3: // up
      state.y -= speed * dt
      if (state.y <= minY) {
        state.y = minY
        state.dir = 0
      }
      break
  }
}

function drawDemo(ctx: CanvasRenderingContext2D, state: DemoState): void {
  // 背景
  ctx.fillStyle = PALETTE.stage
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // 网格辅助线（每 32 px 一根，颜色极暗，便于视觉确认单位）
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

  // 演示方块（模拟玩家坦克）
  ctx.fillStyle = PALETTE.tank.player
  ctx.fillRect(state.x, state.y, TILE_SIZE, TILE_SIZE)

  // 描边突显像素感
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.strokeRect(state.x + 1, state.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
}

export default function GameCanvas({ onStats, disableDemo = false, className }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 演示状态放 ref，避免每帧触发 React 重渲染。
  const demoRef = useRef<DemoState>({ x: 0, y: 0, dir: 0 })

  const { stats } = useGameLoop(canvasRef, {
    onUpdate: (dt) => {
      if (!disableDemo) stepDemo(demoRef.current, dt)
    },
    onRender: (ctx) => {
      if (disableDemo) {
        ctx.fillStyle = PALETTE.stage
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        return
      }
      drawDemo(ctx, demoRef.current)
    },
  })

  // 每次 stats 变化透传给父组件（每秒 1 次，无性能压力）
  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className={'pixelated block border-2 border-outline bg-black ' + (className ?? '')}
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      aria-label="Battle canvas"
    />
  )
}
