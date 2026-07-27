/**
 * SpawnManager —— 敌军刷新调度器。
 *
 * 职责：
 * 1. 消费 [LevelDefinition.enemyQueue](../types.ts#L102-L108) 头部元素，按顺序放到 3 个刷新点。
 * 2. 计时：每 [ENEMY_SPAWN_INTERVAL](../constants.ts#L142-L142) 秒尝试刷一只，
 *    受 [MAX_ENEMIES_ON_FIELD](../constants.ts#L123-L123) 上限约束。
 * 3. 出生保护：新生敌军出生后有 `SPAWN_INVULNERABLE` 秒无敌 + 闪烁（复用 Tank.invulnerable）。
 * 4. 出生点占位检测：若某刷新点正好被玩家 / 已有敌军挡住，跳过这个点并轮到下一个；
 *    三个点都被占则本次尝试作废，等下一个计时窗口再来。
 * 5. 刷新点在 3 个候选中"round-robin"轮转，与红白机原版一致，视觉上更均匀。
 *
 * 教学要点：
 * - **状态与副作用分离**：SpawnManager 不直接把敌军推进游戏世界，而是通过 `spawn` 回调
 *   把新坦克交给调用方（GameCanvas / GameEngine），方便测试。
 * - **确定性**：接受一个 [Rng](../utils/rng.ts#L10-L19)，让敌军 kind 序列可复现（虽然
 *   当前 queue 已是确定序列，但未来 T-15/16 可能用 rng 做随机替代）。
 */

import {
  ENEMY_SPAWN_INTERVAL,
  ENEMY_SPAWN_POINTS,
  MAX_ENEMIES_ON_FIELD,
  TILE_SIZE,
} from '../constants'
import { createEnemyTank, isEnemyTank } from '../entities/Tank'
import { rectsIntersect, makeRect } from '../utils/grid'
import { canTankOccupy } from './MovementSystem'
import type { EnemyKind, LevelMap, Tank } from '../types'

/** 新生敌军的出生保护时长（秒）。红白机原版约 1s 闪烁 + 免疫。 */
export const SPAWN_INVULNERABLE = 1

export interface SpawnManagerOptions {
  /** 关卡预设的敌军类型序列（长度通常 = ENEMIES_PER_STAGE）。 */
  queue: readonly EnemyKind[]
  /** 首波敌军的等待时间；默认 0 = 关卡开始立刻刷第一只。 */
  initialDelay?: number
  /** 每次刷新的时间间隔；默认 [ENEMY_SPAWN_INTERVAL](../constants.ts#L142-L142)。 */
  interval?: number
  /** 同屏最多存活的敌军数量；默认 [MAX_ENEMIES_ON_FIELD](../constants.ts#L123-L123)。 */
  maxOnField?: number
}

export interface SpawnStepInput {
  map: LevelMap
  /** 当前所有活着的坦克（含玩家 + 敌军），用于出生点占位检测。 */
  tanks: readonly Tank[]
  /** 本帧时长（秒）。 */
  dt: number
}

export interface SpawnStepResult {
  /** 本帧刚被生成的敌军（可能是 0/1 只）；调用方需要 push 到自己的 enemies 数组。 */
  spawned: Tank[]
}

/**
 * 敌军刷新调度器。状态维持在实例内部：
 * - `remaining`：还没刷出的敌军类型队列（会被 shift 消费）；
 * - `timer`：距离下一次尝试还剩多少秒；
 * - `pointCursor`：下一次优先尝试哪个出生点（在 3 个中轮转）；
 * - `totalSpawned`：累计已刷出的敌军数量，供 HUD 显示。
 */
export class SpawnManager {
  private readonly remaining: EnemyKind[]
  private readonly interval: number
  private readonly maxOnField: number
  private timer: number
  private pointCursor = 0
  private totalSpawned = 0

  constructor(options: SpawnManagerOptions) {
    this.remaining = [...options.queue]
    this.interval = options.interval ?? ENEMY_SPAWN_INTERVAL
    this.maxOnField = options.maxOnField ?? MAX_ENEMIES_ON_FIELD
    this.timer = options.initialDelay ?? 0
  }

  /** 剩余（未刷 + 场上）敌军的语义数量。场上人数由调用方传入（避免耦合）。 */
  remainingCount(aliveOnField: number): number {
    return this.remaining.length + aliveOnField
  }

  queueLength(): number {
    return this.remaining.length
  }

  totalSpawnedCount(): number {
    return this.totalSpawned
  }

  /** 是否已经把队列刷完（后续只需要等待场上敌军被清完）。 */
  isQueueDrained(): boolean {
    return this.remaining.length === 0
  }

  /**
   * 推进一帧调度。
   * 返回本帧新生成的敌军列表（GameCanvas 直接 push 到 enemies）。
   */
  step(input: SpawnStepInput): SpawnStepResult {
    const spawned: Tank[] = []
    if (this.remaining.length === 0) return { spawned }

    this.timer -= input.dt
    if (this.timer > 0) return { spawned }

    // 达到 tick：这一轮尝试一次刷新。无论是否成功，都重置 timer；
    // 如果被占位/上限挡住，等下一轮再试，保证节奏不会瞬间灌出一堆敌军。
    this.timer = this.interval

    const aliveEnemies = countAliveEnemies(input.tanks)
    if (aliveEnemies >= this.maxOnField) return { spawned }

    const point = this.pickAvailableSpawnPoint(input.map, input.tanks)
    if (!point) return { spawned }

    const kind = this.remaining.shift()!
    const enemy = createEnemyTank({ kind, col: point.col, row: point.row, facing: 'down' })
    enemy.invulnerable = SPAWN_INVULNERABLE
    // 敌军出生就带 cooldown，避免"刚出生就爆头"；createEnemyTank 已经把
    // cooldown 设为 TANK_COOLDOWN.ENEMY，这里再显式确认一次让代码更自证。
    spawned.push(enemy)
    this.totalSpawned++
    return { spawned }
  }

  /**
   * 在 3 个候选刷点里轮转选择一个"没有被坦克盖住 + 地形可占据"的点。
   * 找不到 → null（调用方本轮跳过）。
   */
  private pickAvailableSpawnPoint(
    map: LevelMap,
    tanks: readonly Tank[],
  ): { col: number; row: number } | null {
    const n = ENEMY_SPAWN_POINTS.length
    for (let i = 0; i < n; i++) {
      const idx = (this.pointCursor + i) % n
      const p = ENEMY_SPAWN_POINTS[idx]
      const px = p.col * TILE_SIZE
      const py = p.row * TILE_SIZE
      if (!canTankOccupy(map, px, py)) continue
      const spawnRect = makeRect(px, py, TILE_SIZE, TILE_SIZE)
      const blocked = tanks.some(
        (t) => t.alive && rectsIntersect(spawnRect, makeRect(t.x, t.y, t.w, t.h)),
      )
      if (blocked) continue
      // 命中：把 cursor 推到下一个索引，实现 round-robin。
      this.pointCursor = (idx + 1) % n
      return { col: p.col, row: p.row }
    }
    return null
  }
}

/**
 * 从坦克数组中剔除 alive=false 的敌军（就地修改）。
 * 与 [pruneDeadBullets](./CollisionSystem.ts#L210-L214) 同风格，避免数组无限增长。
 */
export function pruneDeadEnemies(enemies: Tank[]): number {
  let removed = 0
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].alive) {
      enemies.splice(i, 1)
      removed++
    }
  }
  return removed
}

/** 统计 tanks 中"敌军且存活"的数量。SpawnManager 内部与 HUD 都会用。 */
export function countAliveEnemies(tanks: readonly Tank[]): number {
  let n = 0
  for (const t of tanks) if (t.alive && isEnemyTank(t)) n++
  return n
}
