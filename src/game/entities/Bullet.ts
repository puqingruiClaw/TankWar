/**
 * Bullet 实体工厂 —— T-09 起随空格 / 敌军开火事件生成。
 *
 * 与 [Tank](../types.ts#L57-L70) 一样是纯数据实体，具体推进 / 命中判定放在
 * [CollisionSystem](../systems/CollisionSystem.ts) 里。
 *
 * 尺寸约定：子弹 8×8，居中于坦克 32×32 的炮口前 4px，让视觉上"从炮管冒出"。
 */

import { BULLET_SPEED, TILE_SIZE } from '../constants'
import { allocEntityId, isEnemyTank } from './Tank'
import type { Bullet, Direction, Tank } from '../types'

/** 子弹方形边长（像素）。红白机原版为 3×3，本项目放大到 8×8 更清晰。 */
export const BULLET_SIZE = 8

const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * 从坦克炮口发射一颗子弹。
 * - x/y 位于坦克中心，再沿方向偏移半格，使子弹"看起来从炮管尖端出膛"。
 * - power：玩家 level ≥ 3 或敌军 kind='power' 时为 2（可击破钢墙），否则 1。
 * - speed：玩家/basic/armor 用 NORMAL，fast/power 用 FAST（对齐红白机手感）。
 */
export function createBullet(tank: Tank): Bullet {
  const v = DIR_VECTORS[tank.dir]
  const cx = tank.x + tank.w / 2
  const cy = tank.y + tank.h / 2
  const originX = cx + v.x * (TILE_SIZE / 2) - BULLET_SIZE / 2
  const originY = cy + v.y * (TILE_SIZE / 2) - BULLET_SIZE / 2

  const fromEnemy = isEnemyTank(tank)
  const power: 1 | 2 = tank.kind === 'power' || tank.level >= 3 ? 2 : 1
  const speed =
    tank.kind === 'fast' || tank.kind === 'power' ? BULLET_SPEED.FAST : BULLET_SPEED.NORMAL

  return {
    id: allocEntityId(),
    ownerId: tank.id,
    fromEnemy,
    dir: tank.dir,
    alive: true,
    x: originX,
    y: originY,
    w: BULLET_SIZE,
    h: BULLET_SIZE,
    power,
    speed,
  }
}

/** 便捷判断：某坦克当前是否可以发射（未在冷却，且未死）。 */
export function canTankFire(tank: Tank): boolean {
  return tank.alive && tank.cooldown <= 0
}
