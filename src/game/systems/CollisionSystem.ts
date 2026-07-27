/**
 * CollisionSystem —— 子弹推进 + 命中判定。
 *
 * 职责矩阵（对齐 [technical-architecture 5.3 移动与碰撞](../../../.trae/documents/technical-architecture.md)）：
 *
 *   subject → object    | 结果
 *   ────────────────────┼─────────────────────────────────────────────
 *   bullet → 画布边界    | 子弹销毁
 *   bullet → brick       | 砖块变 EMPTY，子弹销毁
 *   bullet → steel       | power=1 反弹销毁；power=2 钢块变 EMPTY，子弹销毁
 *   bullet → water/ice   | 穿过（不影响）
 *   bullet → grass       | 穿过（不影响，视觉遮蔽由 RenderSystem 处理）
 *   bullet → base        | 基地损毁 → 触发 game-over 事件（回调）
 *   bullet A → bullet B  | 双双销毁（同帧成对消除；红白机原版规则）
 *   bullet → tank        | 若 tank.invulnerable>0 则忽略；否则 tank.hp--，
 *                          hp<=0 → tank.alive=false，子弹销毁（无论是否击杀）
 *
 * 玩家 max 同屏子弹：[PLAYER_MAX_BULLETS](../constants.ts#L112-L112)，由调用方（GameCanvas）判定。
 * 敌军 max 同屏子弹：[ENEMY_MAX_BULLETS](../constants.ts#L115-L115)，同理。
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_CODE, TILE_SIZE } from '../constants'
import { isEnemyTank } from '../entities/Tank'
import {
  forEachOverlappedCell,
  inGridBounds,
  makeRect,
  rectsIntersect,
  tileCodeAt,
} from '../utils/grid'
import type { Bullet, LevelMap, Rect, Tank } from '../types'

const DIR_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const

export interface CollisionEvents {
  /** 基地被击中，触发一次；调用方应切到 game-over。 */
  onBaseHit?: () => void
  /** 玩家坦克被击杀（hp 归零那一刻）。 */
  onPlayerKilled?: (tank: Tank) => void
  /** 敌军坦克被击杀。 */
  onEnemyKilled?: (tank: Tank) => void
  /** 出现一次爆炸（可用于加特效）。位置为爆炸中心像素坐标。 */
  onExplosion?: (x: number, y: number, kind: 'bullet' | 'tank') => void
}

export interface StepBulletsOptions {
  map: LevelMap
  bullets: Bullet[]
  /** 战场上所有活着的坦克（含玩家）。 */
  tanks: Tank[]
  dt: number
  events?: CollisionEvents
}

/**
 * 一帧内推进所有子弹并解决碰撞。就地修改 `bullets` / `tanks` / `map`（brick 破坏）。
 * 返回本帧被销毁的子弹列表，方便调用方生成爆炸特效。
 */
export function stepBullets(options: StepBulletsOptions): Bullet[] {
  const { map, bullets, tanks, dt, events } = options
  const destroyed: Bullet[] = []

  // ── Step 1: 推进 + 与地形/画布边界的碰撞 ────────────────────────────────
  for (const b of bullets) {
    if (!b.alive) continue
    const v = DIR_VECTORS[b.dir]
    b.x += v.x * b.speed * dt
    b.y += v.y * b.speed * dt

    // 出画布 → 直接销毁
    if (b.x + b.w <= 0 || b.x >= CANVAS_WIDTH || b.y + b.h <= 0 || b.y >= CANVAS_HEIGHT) {
      b.alive = false
      destroyed.push(b)
      events?.onExplosion?.(b.x + b.w / 2, b.y + b.h / 2, 'bullet')
      continue
    }

    if (resolveBulletVsTerrain(b, map, events)) {
      destroyed.push(b)
    }
  }

  // ── Step 2: 子弹 ↔ 子弹 相消 ────────────────────────────────────────────
  for (let i = 0; i < bullets.length; i++) {
    const a = bullets[i]
    if (!a.alive) continue
    for (let j = i + 1; j < bullets.length; j++) {
      const b = bullets[j]
      if (!b.alive) continue
      // 同源子弹不相消（避免玩家 lv2 双弹自杀）；敌军间同样规则。
      if (a.fromEnemy === b.fromEnemy) continue
      if (rectsIntersect(bulletRect(a), bulletRect(b))) {
        a.alive = false
        b.alive = false
        destroyed.push(a, b)
        const midX = (a.x + b.x + a.w) / 2
        const midY = (a.y + b.y + a.h) / 2
        events?.onExplosion?.(midX, midY, 'bullet')
        break
      }
    }
  }

  // ── Step 3: 子弹 ↔ 坦克 命中 ────────────────────────────────────────────
  for (const b of bullets) {
    if (!b.alive) continue
    for (const tank of tanks) {
      if (!tank.alive) continue
      if (tank.id === b.ownerId) continue // 不自伤
      // 同阵营免伤（玩家不打玩家、敌军不打敌军）；T-11 敌军 AI 会用到。
      const targetIsEnemy = isEnemyTank(tank)
      if (b.fromEnemy === targetIsEnemy) continue
      if (!rectsIntersect(bulletRect(b), tankRect(tank))) continue

      // 无敌期：子弹被吃掉，坦克不掉血（原版规则：helmet/护罩内免疫）
      if (tank.invulnerable > 0) {
        b.alive = false
        destroyed.push(b)
        events?.onExplosion?.(b.x + b.w / 2, b.y + b.h / 2, 'bullet')
        break
      }

      tank.hp -= 1
      b.alive = false
      destroyed.push(b)

      if (tank.hp <= 0) {
        tank.alive = false
        const cx = tank.x + tank.w / 2
        const cy = tank.y + tank.h / 2
        events?.onExplosion?.(cx, cy, 'tank')
        if (isEnemyTank(tank)) events?.onEnemyKilled?.(tank)
        else events?.onPlayerKilled?.(tank)
      } else {
        events?.onExplosion?.(b.x + b.w / 2, b.y + b.h / 2, 'bullet')
      }
      break
    }
  }

  return destroyed
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function bulletRect(b: Bullet): Rect {
  return makeRect(b.x, b.y, b.w, b.h)
}

function tankRect(t: Tank): Rect {
  return makeRect(t.x, t.y, t.w, t.h)
}

/**
 * 处理"子弹 vs 地形"：遍历子弹 rect 覆盖到的所有网格 tile，遇到硬 tile 就击中。
 * - brick → 恒变 EMPTY，子弹销毁
 * - steel → power=2 才破坏；否则弹开销毁
 * - base  → 立刻触发 onBaseHit，子弹销毁（原版会把 base tile 换成骷髅，
 *           视觉细节留到 T-12 GameOver 场景）
 * - water/ice/grass/empty → 忽略
 *
 * 返回 true 表示子弹本帧已被销毁。
 */
function resolveBulletVsTerrain(bullet: Bullet, map: LevelMap, events?: CollisionEvents): boolean {
  let hit = false
  const cellsToClear: Array<{ col: number; row: number }> = []
  let hitBase = false

  forEachOverlappedCell(bulletRect(bullet), (col, row) => {
    const code = tileCodeAt(map, col, row)
    switch (code) {
      case TILE_CODE.BRICK:
        cellsToClear.push({ col, row })
        hit = true
        return true // 子弹一发只碰第一块砖，避免"一发穿两格"
      case TILE_CODE.STEEL:
        if (bullet.power === 2) cellsToClear.push({ col, row })
        hit = true
        return true
      case TILE_CODE.BASE:
        hitBase = true
        hit = true
        return true
      default:
        return false
    }
  })

  if (!hit) return false

  for (const { col, row } of cellsToClear) {
    if (inGridBounds(col, row)) map[row][col] = TILE_CODE.EMPTY
  }

  bullet.alive = false
  const cx = bullet.x + bullet.w / 2
  const cy = bullet.y + bullet.h / 2
  events?.onExplosion?.(cx, cy, 'bullet')
  if (hitBase) events?.onBaseHit?.()

  return true
}

/** 统计某个 owner 目前存活子弹数（用于 max-bullet 校验）。 */
export function countAliveBulletsByOwner(bullets: Bullet[], ownerId: number): number {
  let n = 0
  for (const b of bullets) if (b.alive && b.ownerId === ownerId) n++
  return n
}

/** 移除所有 alive=false 的子弹，防止数组无限增长。GC 友好。 */
export function pruneDeadBullets(bullets: Bullet[]): void {
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].alive) bullets.splice(i, 1)
  }
}

/** 便捷 pixel 中心工具，供 GameCanvas 生成 explosion 时复用。 */
export function bulletCenter(b: Bullet): { x: number; y: number } {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

/** 便捷：把 tile 坐标转到画布中心，供 base-hit 特效定位。 */
export function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 }
}
