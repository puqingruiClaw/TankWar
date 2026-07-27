/**
 * RenderSystem —— 地形层绘制器。
 *
 * v1 直接对每帧的 CanvasRenderingContext2D 逐 tile 绘制；性能足以支撑 60fps
 * @ 13×13。T-24 会引入离屏 canvas 缓存把静态地形层合成一次，动态层（坦克/
 * 子弹/爆炸）再叠上去。
 *
 * 关键 API：
 * - {@link drawTerrainBelow}：绘制 brick/steel/water/ice/base（在坦克之下）。
 * - {@link drawTerrainAbove}：仅绘制 grass（在坦克之上，用于遮蔽/掩护）。
 * - {@link drawBackground}：填充黑色画布底 + 可选调试网格。
 * - {@link drawTank}：绘制坦克实体（T-08 起接入 Tank 数据结构）。
 *
 * 分层原因：经典红白机《Battle City》的草丛会遮挡坦克，钢/砖/水/冰/base
 * 则永远在坦克之下。把 grass 抽成上层是最贴合语义、也最省状态的做法。
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH, PALETTE, TILE_CODE, TILE_SIZE } from '../constants'
import type { Direction, LevelMap, Tank, TankKind } from '../types'

export interface RenderSystemOptions {
  /** 调试用网格线（每 tile 一根 1px 深色线）；默认 false。 */
  showGrid?: boolean
}

export class RenderSystem {
  private showGrid: boolean

  constructor(options: RenderSystemOptions = {}) {
    this.showGrid = options.showGrid ?? false
  }

  setShowGrid(v: boolean): void {
    this.showGrid = v
  }

  drawBackground(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.stage
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    if (this.showGrid) this.drawGridLines(ctx)
  }

  drawTerrainBelow(ctx: CanvasRenderingContext2D, map: LevelMap): void {
    for (let row = 0; row < map.length; row++) {
      const line = map[row]
      for (let col = 0; col < line.length; col++) {
        const code = line[col]
        const x = col * TILE_SIZE
        const y = row * TILE_SIZE
        switch (code) {
          case TILE_CODE.BRICK:
            drawBrick(ctx, x, y)
            break
          case TILE_CODE.STEEL:
            drawSteel(ctx, x, y)
            break
          case TILE_CODE.WATER:
            drawWater(ctx, x, y)
            break
          case TILE_CODE.ICE:
            drawIce(ctx, x, y)
            break
          case TILE_CODE.BASE:
            drawBase(ctx, x, y)
            break
          default:
            break
        }
      }
    }
  }

  drawTerrainAbove(ctx: CanvasRenderingContext2D, map: LevelMap): void {
    for (let row = 0; row < map.length; row++) {
      const line = map[row]
      for (let col = 0; col < line.length; col++) {
        if (line[col] === TILE_CODE.GRASS) {
          drawGrass(ctx, col * TILE_SIZE, row * TILE_SIZE)
        }
      }
    }
  }

  /**
   * 绘制单个坦克实体。
   * - 无敌期（invulnerable > 0）以 8Hz 频率闪烁，通过 tank.invulnerable 自身衰减
   *   的相位派生，无需外部时钟。
   * - 车体、履带、炮管随 dir 旋转；细节格局全部用 fillRect 拼像素，无 rotate 变换，
   *   保证 pixelated 边缘不糊。
   */
  drawTank(ctx: CanvasRenderingContext2D, tank: Tank): void {
    if (!tank.alive) return
    // 无敌闪烁：每 0.125s 切一次可见性。
    if (tank.invulnerable > 0) {
      const phase = Math.floor(tank.invulnerable * 8) % 2
      if (phase === 1) return
    }
    drawTankSprite(ctx, tank.x, tank.y, tank.dir, tank.kind)
  }

  private drawGridLines(ctx: CanvasRenderingContext2D): void {
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
  }
}

// ─── tile 绘制单元 ───────────────────────────────────────────────────────────
// 每个 32×32 tile 由 4 个 16×16 子块拼成（模仿 NES BC 的砖块单位）。

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const half = TILE_SIZE / 2
  ctx.fillStyle = PALETTE.terrain.brick
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = PALETTE.terrain.brickShadow
  ctx.fillRect(x, y + half - 1, TILE_SIZE, 2)
  ctx.fillRect(x + half - 1, y, 2, half)
  ctx.fillRect(x + 4, y + half + 2, 2, half - 4)
  ctx.fillRect(x + half + 6, y + 2, 2, half - 4)
}

function drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.terrain.steel
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = PALETTE.terrain.steelShadow
  ctx.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE)
  ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4)
  ctx.fillStyle = '#c0c0c0'
  ctx.fillRect(x + 2, y + 2, TILE_SIZE - 8, 2)
  ctx.fillRect(x + 2, y + 2, 2, TILE_SIZE - 8)
}

function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.terrain.water
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = PALETTE.terrain.waterHi
  ctx.fillRect(x + 4, y + 6, 10, 2)
  ctx.fillRect(x + 18, y + 12, 10, 2)
  ctx.fillRect(x + 4, y + 20, 10, 2)
  ctx.fillRect(x + 18, y + 26, 10, 2)
}

function drawIce(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.terrain.ice
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + 4, y + 4, 6, 2)
  ctx.fillRect(x + 20, y + 10, 6, 2)
  ctx.fillRect(x + 8, y + 22, 6, 2)
}

function drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.terrain.grass
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = '#7ed84a'
  for (let i = 0; i < TILE_SIZE; i += 4) {
    ctx.fillRect(x + i, y + 2, 2, 4)
    ctx.fillRect(x + i + 2, y + 14, 2, 4)
    ctx.fillRect(x + i, y + 26, 2, 4)
  }
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#000000'
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = PALETTE.terrain.base
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  ctx.fillRect(cx - 10, cy - 4, 20, 6)
  ctx.fillRect(cx - 8, cy - 10, 4, 6)
  ctx.fillRect(cx + 4, cy - 10, 4, 6)
  ctx.fillRect(cx - 6, cy + 2, 12, 8)
  ctx.fillStyle = '#000000'
  ctx.fillRect(cx - 2, cy - 4, 4, 6)
  ctx.fillRect(cx - 4, cy + 4, 2, 4)
  ctx.fillRect(cx + 2, cy + 4, 2, 4)
}

// ─── 坦克绘制单元 ────────────────────────────────────────────────────────────
// 32×32 tile：4px 履带 × 2（左右两侧）+ 22px 主车体 + 8px 炮管。
// dir 决定履带方位与炮管指向；kind 决定色调（后续接敌军种类）。

function tankPalette(kind: TankKind): { body: string; track: string; barrel: string } {
  const p = PALETTE.tank
  switch (kind) {
    case 'player':
      return { body: p.player, track: '#7a7a1a', barrel: '#ffffff' }
    case 'basic':
      return { body: p.basic, track: '#5c5c5c', barrel: '#000000' }
    case 'fast':
      return { body: p.fast, track: '#7a5a10', barrel: '#000000' }
    case 'power':
      return { body: p.power, track: '#3d3d3d', barrel: '#000000' }
    case 'armor':
      return { body: p.armor, track: '#5b2857', barrel: '#000000' }
  }
}

function drawTankSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Direction,
  kind: TankKind,
): void {
  const colors = tankPalette(kind)
  const S = TILE_SIZE

  // 履带：贴左右（垂直行进）或上下（水平行进）边缘。
  ctx.fillStyle = colors.track
  if (dir === 'up' || dir === 'down') {
    ctx.fillRect(x + 2, y + 4, 4, S - 8)
    ctx.fillRect(x + S - 6, y + 4, 4, S - 8)
  } else {
    ctx.fillRect(x + 4, y + 2, S - 8, 4)
    ctx.fillRect(x + 4, y + S - 6, S - 8, 4)
  }

  // 主车体：略缩边，让履带露出。
  ctx.fillStyle = colors.body
  ctx.fillRect(x + 6, y + 6, S - 12, S - 12)

  // 车顶炮塔：一个 8×8 小方块居中。
  ctx.fillRect(x + S / 2 - 4, y + S / 2 - 4, 8, 8)

  // 炮管：从中心伸向 dir。
  ctx.fillStyle = colors.barrel
  const cx = x + S / 2
  const cy = y + S / 2
  switch (dir) {
    case 'up':
      ctx.fillRect(cx - 2, y + 2, 4, S / 2 - 2)
      break
    case 'down':
      ctx.fillRect(cx - 2, cy, 4, S / 2 - 2)
      break
    case 'left':
      ctx.fillRect(x + 2, cy - 2, S / 2 - 2, 4)
      break
    case 'right':
      ctx.fillRect(cx, cy - 2, S / 2 - 2, 4)
      break
  }
}
