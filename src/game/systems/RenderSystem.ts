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
 * - {@link drawBullet}：绘制子弹（T-09 起接入 Bullet）。
 * - {@link drawExplosion}：绘制爆炸粒子帧（T-09 起接入 Explosion）。
 *
 * 分层原因：经典红白机《Battle City》的草丛会遮挡坦克，钢/砖/水/冰/base
 * 则永远在坦克之下。把 grass 抽成上层是最贴合语义、也最省状态的做法。
 */

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  POWERUP_LIFETIME,
  TILE_CODE,
  TILE_SIZE,
} from '../constants'
import type {
  Bullet,
  Direction,
  Explosion,
  LevelMap,
  PowerUp,
  PowerUpKind,
  Tank,
  TankKind,
} from '../types'

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
          case TILE_CODE.BASE_DEAD:
            drawBaseDead(ctx, x, y)
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

  /**
   * 绘制单发子弹。8×8 白色方块 + 前方 2px 拖尾。
   * power=2（可击破钢块）子弹显示为亮青色，与普通子弹区分。
   */
  drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet): void {
    if (!bullet.alive) return
    ctx.fillStyle = bullet.power === 2 ? '#8ee8ff' : PALETTE.bullet
    ctx.fillRect(Math.round(bullet.x), Math.round(bullet.y), bullet.w, bullet.h)
    // 拖尾：向 dir 反方向多画 2px，让高速子弹更有速度感。
    const v = BULLET_TAIL_VECTORS[bullet.dir]
    ctx.fillRect(
      Math.round(bullet.x + v.x),
      Math.round(bullet.y + v.y),
      v.x === 0 ? bullet.w : 2,
      v.y === 0 ? bullet.h : 2,
    )
  }

  /**
   * 绘制爆炸帧动画。基于 explosion.ttl 派生帧号 —— 无需外部时钟。
   * 3 帧：小 → 中 → 大，共 0.3s。tank 类型的爆炸半径更大。
   */
  drawExplosion(ctx: CanvasRenderingContext2D, explosion: Explosion): void {
    if (explosion.ttl <= 0) return
    const isTank = explosion.w >= TILE_SIZE
    const cx = explosion.x + explosion.w / 2
    const cy = explosion.y + explosion.h / 2
    const frame = explosion.frame
    const base = isTank ? 6 : 3
    const size = base + frame * (isTank ? 5 : 3)
    ctx.fillStyle = frame === 2 ? '#f2b431' : '#ffffff'
    // 十字花瓣型爆炸
    ctx.fillRect(cx - size, cy - 2, size * 2, 4)
    ctx.fillRect(cx - 2, cy - size, 4, size * 2)
    if (isTank && frame >= 1) {
      ctx.fillStyle = '#b34a20'
      const s2 = size - 2
      ctx.fillRect(cx - s2, cy - s2, 4, 4)
      ctx.fillRect(cx + s2 - 4, cy - s2, 4, 4)
      ctx.fillRect(cx - s2, cy + s2 - 4, 4, 4)
      ctx.fillRect(cx + s2 - 4, cy + s2 - 4, 4, 4)
    }
  }

  /**
   * 绘制单个道具（T-17）。
   * - 尺寸固定 TILE_SIZE，绘制原点 (p.x, p.y)。
   * - 剩余寿命 ≤ 3s 时以 8Hz 频率闪烁（提示玩家快消失）。
   * - kind 决定内部图案，全部用 fillRect 拼像素，风格与坦克/地形一致。
   */
  drawPowerUp(ctx: CanvasRenderingContext2D, powerUp: PowerUp): void {
    if (!powerUp.alive) return
    // 剩余寿命提示：最后 3 秒 8Hz 闪烁。
    const warn = powerUp.lifetime <= 3
    if (warn) {
      const phase = Math.floor(powerUp.lifetime * 8) % 2
      if (phase === 1) return
    }
    // 呼吸感提示：常规期间也用 4Hz 让高光边有节奏地变化，避免道具"静如枯木"。
    const breatheOn = Math.floor((POWERUP_LIFETIME - powerUp.lifetime) * 4) % 2 === 0
    drawPowerUpSprite(ctx, powerUp.x, powerUp.y, powerUp.kind, breatheOn)
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

/**
 * 已毁基地（T-14）：灰色骷髅头 + 交叉骨。红白机原版毁鹰是"鹰徽变灰 + 十字骨"，
 * 这里用像素方块拼一个粗略的骷髅轮廓，让玩家一眼看出"这里曾经是基地"。
 */
function drawBaseDead(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#000000'
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)

  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2

  // 头骨主体：14×12 灰色圆角矩形（用 3 段拼接近似圆角）。
  ctx.fillStyle = PALETTE.terrain.baseDeadHi
  ctx.fillRect(cx - 6, cy - 10, 12, 2)
  ctx.fillRect(cx - 7, cy - 8, 14, 10)
  ctx.fillRect(cx - 5, cy + 2, 10, 2)

  // 骷髅"下颚"：两条短牙。
  ctx.fillRect(cx - 4, cy + 4, 2, 3)
  ctx.fillRect(cx + 2, cy + 4, 2, 3)

  // 眼窝 & 鼻孔：暗色。
  ctx.fillStyle = PALETTE.terrain.baseDead
  ctx.fillRect(cx - 5, cy - 5, 3, 4)
  ctx.fillRect(cx + 2, cy - 5, 3, 4)
  ctx.fillRect(cx - 1, cy, 2, 2)
}

// ─── 坦克绘制单元 ────────────────────────────────────────────────────────────
// 32×32 tile：4px 履带 × 2（左右两侧）+ 22px 主车体 + 8px 炮管。
// dir 决定履带方位与炮管指向；kind 决定色调（后续接敌军种类）。

/** 子弹拖尾偏移向量：向 dir 反方向偏 2px。 */
const BULLET_TAIL_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 2 },
  down: { x: 0, y: -2 },
  left: { x: 2, y: 0 },
  right: { x: -2, y: 0 },
}

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

// ─── 道具绘制单元（T-17） ─────────────────────────────────────────────────────
// 6 种 kind 各自的 32×32 像素图案。所有 kind 共享：
//   1. 一圈金色外框（PALETTE.powerup.frame），呼吸态 on/off 决定是否绘制；
//   2. 一个黑色底板，让内部图案在任意地形上都有足够对比度。
// 内部主图案由各自的 drawPowerUp<Kind>() 完成。

function drawPowerUpSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: PowerUpKind,
  breatheOn: boolean,
): void {
  const S = TILE_SIZE
  ctx.fillStyle = '#000000'
  ctx.fillRect(x, y, S, S)
  if (breatheOn) {
    ctx.fillStyle = PALETTE.powerup.frame
    ctx.fillRect(x, y, S, 2)
    ctx.fillRect(x, y + S - 2, S, 2)
    ctx.fillRect(x, y, 2, S)
    ctx.fillRect(x + S - 2, y, 2, S)
  }

  switch (kind) {
    case 'star':
      drawStarIcon(ctx, x, y)
      break
    case 'helmet':
      drawHelmetIcon(ctx, x, y)
      break
    case 'bomb':
      drawBombIcon(ctx, x, y)
      break
    case 'shovel':
      drawShovelIcon(ctx, x, y)
      break
    case 'clock':
      drawClockIcon(ctx, x, y)
      break
    case 'tank':
      drawTankIcon(ctx, x, y)
      break
  }
}

/** 五角星：底部四条外向像素 + 中心一小块高光。 */
function drawStarIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  ctx.fillStyle = PALETTE.powerup.star
  ctx.fillRect(cx - 2, cy - 12, 4, 24)
  ctx.fillRect(cx - 12, cy - 2, 24, 4)
  ctx.fillRect(cx - 8, cy - 8, 4, 4)
  ctx.fillRect(cx + 4, cy - 8, 4, 4)
  ctx.fillRect(cx - 8, cy + 4, 4, 4)
  ctx.fillRect(cx + 4, cy + 4, 4, 4)
  ctx.fillStyle = PALETTE.powerup.hi
  ctx.fillRect(cx - 2, cy - 2, 4, 4)
}

/** helmet：一顶头盔轮廓。上半圆 + 下颚条 + 左右耳罩。 */
function drawHelmetIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  ctx.fillStyle = PALETTE.powerup.helmet
  // 头盔顶：14 宽 6 高。
  ctx.fillRect(cx - 8, cy - 8, 16, 4)
  ctx.fillRect(cx - 10, cy - 4, 20, 6)
  // 下沿：中间凹一格模拟护目镜切割。
  ctx.fillRect(cx - 10, cy + 2, 6, 4)
  ctx.fillRect(cx + 4, cy + 2, 6, 4)
  ctx.fillStyle = PALETTE.powerup.hi
  ctx.fillRect(cx - 6, cy - 6, 4, 2)
}

/** bomb：一颗圆球 + 顶部导火索。 */
function drawBombIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  ctx.fillStyle = PALETTE.powerup.bomb
  ctx.fillRect(cx - 8, cy - 4, 16, 12)
  ctx.fillRect(cx - 6, cy - 8, 12, 4)
  ctx.fillRect(cx - 10, cy - 2, 20, 8)
  // 导火索
  ctx.fillStyle = '#f2b431'
  ctx.fillRect(cx - 1, cy - 12, 2, 4)
  ctx.fillRect(cx + 1, cy - 14, 2, 2)
  // 高光
  ctx.fillStyle = PALETTE.powerup.hi
  ctx.fillRect(cx - 4, cy - 2, 3, 3)
}

/** shovel：一把铁锹。竖直手柄 + 底部铲斗。 */
function drawShovelIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  // 手柄
  ctx.fillStyle = '#c65fbf'
  ctx.fillRect(cx - 2, cy - 12, 4, 14)
  // 铲斗
  ctx.fillStyle = PALETTE.powerup.shovel
  ctx.fillRect(cx - 8, cy + 2, 16, 4)
  ctx.fillRect(cx - 6, cy + 6, 12, 4)
  ctx.fillRect(cx - 4, cy + 10, 8, 2)
  // 顶端 T 型握把
  ctx.fillStyle = '#c65fbf'
  ctx.fillRect(cx - 6, cy - 12, 12, 3)
}

/** clock：一个圆钟盘 + 时针分针。 */
function drawClockIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  ctx.fillStyle = PALETTE.powerup.clock
  ctx.fillRect(cx - 8, cy - 6, 16, 12)
  ctx.fillRect(cx - 6, cy - 8, 12, 16)
  ctx.fillStyle = '#000000'
  ctx.fillRect(cx - 6, cy - 4, 12, 8)
  ctx.fillRect(cx - 4, cy - 6, 8, 12)
  // 指针：一横（3 点）一竖（12 点）
  ctx.fillStyle = PALETTE.powerup.clock
  ctx.fillRect(cx - 1, cy - 3, 2, 4)
  ctx.fillRect(cx, cy - 1, 4, 2)
  // 顶部把手
  ctx.fillStyle = '#a0a0a0'
  ctx.fillRect(cx - 2, cy - 10, 4, 2)
}

/** tank：一个迷你坦克剪影。 */
function drawTankIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  ctx.fillStyle = PALETTE.powerup.tank
  // 履带
  ctx.fillRect(cx - 8, cy - 2, 3, 10)
  ctx.fillRect(cx + 5, cy - 2, 3, 10)
  // 车体
  ctx.fillRect(cx - 5, cy - 4, 10, 10)
  // 炮塔
  ctx.fillRect(cx - 2, cy - 8, 4, 4)
  ctx.fillRect(cx - 1, cy - 12, 2, 5)
  // 高光
  ctx.fillStyle = PALETTE.powerup.hi
  ctx.fillRect(cx - 3, cy - 2, 2, 2)
}
