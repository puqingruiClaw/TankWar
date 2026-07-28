/**
 * CollisionSystem 单元测试（T-23）
 *
 * 覆盖 [stepBullets](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/systems/CollisionSystem.ts#L65-L148) 的六类核心行为：
 * 1. bullet → brick：砖块变 EMPTY，子弹销毁
 * 2. bullet → steel：power=1 弹开销毁；power=2 打穿钢并变 EMPTY
 * 3. bullet → base：触发 onBaseHit，tile 变 BASE_DEAD，二次命中同 tile 应穿过
 * 4. bullet ↔ bullet 相消：玩家 vs 敌军子弹同时销毁
 * 5. bullet → tank：命中 -1 HP；hp<=0 触发 onEnemyKilled/onPlayerKilled
 * 6. bullet → invulnerable tank：子弹被吃，坦克 HP 不变
 * + 边界出界：子弹销毁
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stepBullets } from '@/game/systems/CollisionSystem'
import { MAP_COLS, MAP_ROWS, TILE_CODE, TILE_SIZE } from '@/game/constants'
import type { Bullet, LevelMap, Tank } from '@/game/types'

let nextId = 1000
function id(): number {
  return nextId++
}

beforeEach(() => {
  nextId = 1000
})

/** 构造一张纯 EMPTY 的合法地图。*/
function emptyMap(): LevelMap {
  const rows: LevelMap = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: number[] = []
    for (let c = 0; c < MAP_COLS; c++) row.push(TILE_CODE.EMPTY)
    rows.push(row as unknown as LevelMap[number])
  }
  return rows
}

/** 构造子弹（默认 8×8）。 */
function mkBullet(patch: Partial<Bullet> & Pick<Bullet, 'x' | 'y' | 'dir' | 'fromEnemy'>): Bullet {
  return {
    id: id(),
    ownerId: patch.ownerId ?? id(),
    fromEnemy: patch.fromEnemy,
    dir: patch.dir,
    alive: true,
    x: patch.x,
    y: patch.y,
    w: 8,
    h: 8,
    power: patch.power ?? 1,
    speed: patch.speed ?? 200,
  }
}

/** 构造坦克（32×32，位于给定像素坐标）。 */
function mkTank(patch: Partial<Tank> & Pick<Tank, 'x' | 'y' | 'kind'>): Tank {
  return {
    id: patch.id ?? id(),
    kind: patch.kind,
    dir: patch.dir ?? 'up',
    alive: patch.alive ?? true,
    x: patch.x,
    y: patch.y,
    w: TILE_SIZE,
    h: TILE_SIZE,
    hp: patch.hp ?? (patch.kind === 'armor' ? 4 : 1),
    speed: patch.speed ?? 100,
    cooldown: patch.cooldown ?? 0,
    level: patch.level ?? 0,
    invulnerable: patch.invulnerable ?? 0,
    slideRemaining: patch.slideRemaining ?? 0,
  }
}

describe('stepBullets：子弹 vs 地形', () => {
  it('子弹打砖块 → 砖块变 EMPTY，子弹销毁，onExplosion(bullet)', () => {
    const map = emptyMap()
    // 在 (col=5, row=5) 放一块砖
    map[5][5] = TILE_CODE.BRICK
    // 子弹朝右移动，1 tick 内穿过砖块的位置：从 x=5*32-1 出发朝右，dt=0.02s * speed=200 = 4px 后与砖块 rect 重叠
    const bullet = mkBullet({
      x: 5 * TILE_SIZE - 1,
      y: 5 * TILE_SIZE + TILE_SIZE / 2 - 4,
      dir: 'right',
      fromEnemy: false,
      speed: 200,
    })
    const onExplosion = vi.fn()
    stepBullets({ map, bullets: [bullet], tanks: [], dt: 0.05, events: { onExplosion } })
    expect(map[5][5]).toBe(TILE_CODE.EMPTY)
    expect(bullet.alive).toBe(false)
    expect(onExplosion).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'bullet')
  })

  it('普通子弹（power=1）打钢块 → 钢块不变，子弹被销毁', () => {
    const map = emptyMap()
    map[5][5] = TILE_CODE.STEEL
    const bullet = mkBullet({
      x: 5 * TILE_SIZE - 1,
      y: 5 * TILE_SIZE + TILE_SIZE / 2 - 4,
      dir: 'right',
      fromEnemy: false,
      power: 1,
      speed: 200,
    })
    stepBullets({ map, bullets: [bullet], tanks: [], dt: 0.05 })
    expect(map[5][5]).toBe(TILE_CODE.STEEL) // 钢块保留
    expect(bullet.alive).toBe(false) // 子弹销毁
  })

  it('强力子弹（power=2）打钢块 → 钢块变 EMPTY，子弹销毁', () => {
    const map = emptyMap()
    map[5][5] = TILE_CODE.STEEL
    const bullet = mkBullet({
      x: 5 * TILE_SIZE - 1,
      y: 5 * TILE_SIZE + TILE_SIZE / 2 - 4,
      dir: 'right',
      fromEnemy: false,
      power: 2,
      speed: 200,
    })
    stepBullets({ map, bullets: [bullet], tanks: [], dt: 0.05 })
    expect(map[5][5]).toBe(TILE_CODE.EMPTY)
    expect(bullet.alive).toBe(false)
  })

  it('打基地 → 触发 onBaseHit，tile 变 BASE_DEAD；BASE_DEAD 上后续子弹直接穿过', () => {
    const map = emptyMap()
    map[6][6] = TILE_CODE.BASE
    // 第一发：击毁基地
    const b1 = mkBullet({
      x: 6 * TILE_SIZE - 1,
      y: 6 * TILE_SIZE + TILE_SIZE / 2 - 4,
      dir: 'right',
      fromEnemy: true,
      speed: 200,
    })
    const onBaseHit = vi.fn()
    stepBullets({ map, bullets: [b1], tanks: [], dt: 0.05, events: { onBaseHit } })
    expect(onBaseHit).toHaveBeenCalledTimes(1)
    expect(map[6][6]).toBe(TILE_CODE.BASE_DEAD)
    expect(b1.alive).toBe(false)
    // 第二发：BASE_DEAD 不再阻挡，也不再触发 onBaseHit
    const b2 = mkBullet({
      x: 6 * TILE_SIZE - 1,
      y: 6 * TILE_SIZE + TILE_SIZE / 2 - 4,
      dir: 'right',
      fromEnemy: true,
      speed: 200,
    })
    const onBaseHit2 = vi.fn()
    stepBullets({ map, bullets: [b2], tanks: [], dt: 0.05, events: { onBaseHit: onBaseHit2 } })
    expect(onBaseHit2).not.toHaveBeenCalled()
    expect(b2.alive).toBe(true) // 未被销毁（未撞任何阻挡）
  })

  it('子弹出画布 → 销毁 + onExplosion', () => {
    const map = emptyMap()
    const bullet = mkBullet({
      x: -4,
      y: 100,
      dir: 'left',
      fromEnemy: false,
      speed: 200,
    })
    const onExplosion = vi.fn()
    stepBullets({ map, bullets: [bullet], tanks: [], dt: 0.05, events: { onExplosion } })
    expect(bullet.alive).toBe(false)
    expect(onExplosion).toHaveBeenCalled()
  })
})

describe('stepBullets：子弹 ↔ 子弹相消', () => {
  it('玩家 vs 敌军子弹重叠 → 双双销毁，一次 onExplosion(bullet)', () => {
    const map = emptyMap()
    // 两颗子弹初始已重叠，dt=0 也应命中
    const b1 = mkBullet({ x: 100, y: 100, dir: 'right', fromEnemy: false })
    const b2 = mkBullet({ x: 100, y: 100, dir: 'left', fromEnemy: true })
    const onExplosion = vi.fn()
    stepBullets({ map, bullets: [b1, b2], tanks: [], dt: 0, events: { onExplosion } })
    expect(b1.alive).toBe(false)
    expect(b2.alive).toBe(false)
    // 至少一次；具体次数取决于实现（相消 1 次）
    expect(onExplosion).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'bullet')
  })

  it('同阵营子弹（玩家 vs 玩家）不相消', () => {
    const map = emptyMap()
    const b1 = mkBullet({ x: 100, y: 100, dir: 'right', fromEnemy: false })
    const b2 = mkBullet({ x: 100, y: 100, dir: 'left', fromEnemy: false })
    stepBullets({ map, bullets: [b1, b2], tanks: [], dt: 0 })
    expect(b1.alive).toBe(true)
    expect(b2.alive).toBe(true)
  })
})

describe('stepBullets：子弹 → 坦克', () => {
  it('敌军子弹击中 hp=1 的玩家 → 玩家死亡 + onPlayerKilled', () => {
    const map = emptyMap()
    const player = mkTank({ id: 1, kind: 'player', x: 200, y: 200, hp: 1 })
    // 子弹已重叠玩家位置（避免依赖 dt 计算）
    const bullet = mkBullet({ x: 210, y: 210, dir: 'right', fromEnemy: true })
    const events = { onPlayerKilled: vi.fn(), onExplosion: vi.fn() }
    stepBullets({ map, bullets: [bullet], tanks: [player], dt: 0, events })
    expect(player.alive).toBe(false)
    expect(events.onPlayerKilled).toHaveBeenCalledTimes(1)
    expect(events.onExplosion).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'tank')
    expect(bullet.alive).toBe(false)
  })

  it('玩家子弹击中 hp=4 的 armor 敌军 → hp=3，未死，无 onEnemyKilled', () => {
    const map = emptyMap()
    const armor = mkTank({ id: 2, kind: 'armor', x: 200, y: 200, hp: 4 })
    const bullet = mkBullet({ x: 210, y: 210, dir: 'right', fromEnemy: false })
    const events = { onEnemyKilled: vi.fn() }
    stepBullets({ map, bullets: [bullet], tanks: [armor], dt: 0, events })
    expect(armor.hp).toBe(3)
    expect(armor.alive).toBe(true)
    expect(events.onEnemyKilled).not.toHaveBeenCalled()
    expect(bullet.alive).toBe(false)
  })

  it('无敌坦克（invulnerable>0）吃掉子弹但不掉血', () => {
    const map = emptyMap()
    const player = mkTank({
      id: 3,
      kind: 'player',
      x: 200,
      y: 200,
      hp: 1,
      invulnerable: 2,
    })
    const bullet = mkBullet({ x: 210, y: 210, dir: 'right', fromEnemy: true })
    const events = { onPlayerKilled: vi.fn() }
    stepBullets({ map, bullets: [bullet], tanks: [player], dt: 0, events })
    expect(player.hp).toBe(1)
    expect(player.alive).toBe(true)
    expect(events.onPlayerKilled).not.toHaveBeenCalled()
    expect(bullet.alive).toBe(false) // 子弹仍被消耗
  })

  it('同阵营免伤：敌军子弹不打敌军', () => {
    const map = emptyMap()
    const enemy = mkTank({ id: 4, kind: 'basic', x: 200, y: 200, hp: 1 })
    const bullet = mkBullet({
      x: 210,
      y: 210,
      dir: 'right',
      fromEnemy: true,
      ownerId: 9999, // 不同 id，但同阵营
    })
    stepBullets({ map, bullets: [bullet], tanks: [enemy], dt: 0 })
    expect(enemy.hp).toBe(1)
    expect(enemy.alive).toBe(true)
    expect(bullet.alive).toBe(true)
  })

  it('自伤规避：子弹不打自己（ownerId 相同）', () => {
    const map = emptyMap()
    const player = mkTank({ id: 5, kind: 'player', x: 200, y: 200, hp: 1 })
    // 玩家自己的子弹（fromEnemy=false，与玩家阵营相同，本来就免伤，
    // 这里再叠加 ownerId 相等以覆盖 early-return）
    const bullet = mkBullet({
      x: 210,
      y: 210,
      dir: 'right',
      fromEnemy: false,
      ownerId: 5,
    })
    stepBullets({ map, bullets: [bullet], tanks: [player], dt: 0 })
    expect(player.alive).toBe(true)
    expect(bullet.alive).toBe(true)
  })
})
