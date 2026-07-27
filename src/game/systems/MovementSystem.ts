/**
 * MovementSystem —— 坦克运动与地形碰撞求解。
 *
 * 输入：Tank + InputIntent + LevelMap + dt。
 * 输出：直接修改传入的 Tank（in-place），保持 dir 与 (x, y) 同步。
 *
 * 规则（对齐 [technical-architecture 5.3 移动与碰撞](../../../.trae/documents/technical-architecture.md)）：
 * 1. 方向变化立即生效：新方向优先级 = 输入意图；无输入时保留 dir 并停止移动。
 * 2. 转向"贴齐"：当方向从水平切到垂直（或反之）时，把非行进轴坐标 snap 到最近的 tile 边界，
 *    避免 32px 坦克被 32px 网格卡住。
 * 3. 阻挡地形 = { brick, steel, water, base } —— 尝试推进后若与阻挡集重叠则回滚到 axis-align 位置。
 * 4. Empty / grass / ice 不阻挡（草丛视觉遮蔽；ice 未来会触发滑行，见 slideRemaining）。
 * 5. 出画布也视为阻挡（用 canvas AABB 检测）。
 *
 * 该系统与 InputSystem 解耦：只吃已解析好的 [InputIntent](../types.ts#L124-L128)。
 */

import { TILE_SIZE } from '../constants'
import { alignToTile, collidesWithTerrain, inCanvasBounds, makeRect } from '../utils/grid'
import type { Direction, InputIntent, LevelMap, Rect, Tank, TileType } from '../types'

/** 阻挡坦克前进的地形集合。grass/ice 不在其中（草：遮蔽；冰：滑行）。 */
export const TANK_BLOCKING_TILES: ReadonlySet<TileType> = new Set([
  'brick',
  'steel',
  'water',
  'base',
])

const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** 水平方向集合，用于快速判断"横→纵"或"纵→横"切换。 */
const HORIZONTAL: ReadonlySet<Direction> = new Set(['left', 'right'])

function isHorizontal(d: Direction): boolean {
  return HORIZONTAL.has(d)
}

/**
 * 判断给定矩形是否可以占据（画布内 + 不与阻挡地形重叠）。
 * 单一入口，避免在多处重复条件。
 */
function canOccupy(map: LevelMap, rect: Rect): boolean {
  if (!inCanvasBounds(rect)) return false
  return !collidesWithTerrain(map, rect, TANK_BLOCKING_TILES)
}

/**
 * 转向对齐：当坦克切换到"另一根轴"上运动时，把非行进轴坐标贴齐到 tile 边界。
 * 例：原来向右走（水平轴），玩家按下 ↑ 切纵轴 —— 把 y 贴到最近的 32px 倍数。
 * 若贴齐后与地形冲突（罕见：边角刚好卡住砖块），保持原坐标不动。
 */
function alignForTurn(map: LevelMap, tank: Tank, newDir: Direction): void {
  const turningToVertical = isHorizontal(tank.dir) && !isHorizontal(newDir)
  const turningToHorizontal = !isHorizontal(tank.dir) && isHorizontal(newDir)

  if (!turningToVertical && !turningToHorizontal) return

  const snappedY = alignToTile(tank.y, 'round')
  const snappedX = alignToTile(tank.x, 'round')

  if (turningToVertical) {
    const probe = makeRect(tank.x, snappedY, tank.w, tank.h)
    if (canOccupy(map, probe)) tank.y = snappedY
  } else {
    const probe = makeRect(snappedX, tank.y, tank.w, tank.h)
    if (canOccupy(map, probe)) tank.x = snappedX
  }
}

export interface MoveResult {
  moved: boolean
  blocked: boolean
}

/**
 * 尝试沿 tank.dir 推进 speed*dt 像素。
 * 若与阻挡地形/画布边界冲突，则回退到"能走的最大距离"（简单 axis-align 收敛）。
 */
function tryAdvance(map: LevelMap, tank: Tank, dt: number): MoveResult {
  const step = tank.speed * dt
  if (step <= 0) return { moved: false, blocked: false }

  const v = DIR_VECTORS[tank.dir]
  const dx = v.x * step
  const dy = v.y * step

  const targetX = tank.x + dx
  const targetY = tank.y + dy
  const target = makeRect(targetX, targetY, tank.w, tank.h)

  if (canOccupy(map, target)) {
    tank.x = targetX
    tank.y = targetY
    return { moved: true, blocked: false }
  }

  // 卡到障碍：把坦克贴到"当前方向上下一堵墙的前一格"。
  // 用 axis-align：非行进轴不动，把行进轴坐标 snap 到最近整数 tile 边界（向行进方向的反方向取整）。
  if (v.x !== 0) {
    // 水平方向：找到 tank.x 与 targetX 之间、能占据的最远整数 tile 位置
    const snapped = v.x > 0 ? alignToTile(targetX, 'floor') : alignToTile(targetX, 'ceil')
    const probe = makeRect(snapped, tank.y, tank.w, tank.h)
    if (snapped !== tank.x && canOccupy(map, probe)) {
      tank.x = snapped
      return { moved: true, blocked: true }
    }
  } else {
    const snapped = v.y > 0 ? alignToTile(targetY, 'floor') : alignToTile(targetY, 'ceil')
    const probe = makeRect(tank.x, snapped, tank.w, tank.h)
    if (snapped !== tank.y && canOccupy(map, probe)) {
      tank.y = snapped
      return { moved: true, blocked: true }
    }
  }

  return { moved: false, blocked: true }
}

export interface UpdateTankOptions {
  /** 输入意图（玩家路径）；敌军由 AI 生成同样结构。 */
  intent?: InputIntent
  /** 强制方向（AI 用），优先级低于 intent。 */
  forcedDir?: Direction | null
}

/**
 * 更新单个坦克一帧：处理方向切换（含对齐）+ 推进 + 冷却/无敌计时衰减。
 * 返回本帧是否实际发生移动，方便渲染层做履带动画索引。
 */
export function updateTank(
  map: LevelMap,
  tank: Tank,
  dt: number,
  options: UpdateTankOptions = {},
): MoveResult {
  if (!tank.alive) return { moved: false, blocked: false }

  // 冷却 / 无敌 / 滑行时间衰减（Bullet & Ice 在 T-09/T-10 使用）。
  if (tank.cooldown > 0) tank.cooldown = Math.max(0, tank.cooldown - dt)
  if (tank.invulnerable > 0) tank.invulnerable = Math.max(0, tank.invulnerable - dt)
  if (tank.slideRemaining > 0) tank.slideRemaining = Math.max(0, tank.slideRemaining - dt)

  const desiredDir = options.intent?.dir ?? options.forcedDir ?? null

  if (desiredDir && desiredDir !== tank.dir) {
    alignForTurn(map, tank, desiredDir)
    tank.dir = desiredDir
  }

  if (!desiredDir) {
    // 无方向输入：仅计时衰减，位置保持。
    return { moved: false, blocked: false }
  }

  return tryAdvance(map, tank, dt)
}

/** 便捷导出：暴露方向向量表供 RenderSystem / BulletSystem 复用，避免重复定义。 */
export const DIRECTION_VECTORS = DIR_VECTORS

/** 检查任意坐标下 rect 是否能被坦克占据（供其它 system 如 spawn 用）。 */
export function canTankOccupy(map: LevelMap, x: number, y: number): boolean {
  return canOccupy(map, makeRect(x, y, TILE_SIZE, TILE_SIZE))
}

/** 单元测试友好：暴露 canOccupy 私有工具的对外别名。 */
export const isRectFreeForTank = canOccupy

/**
 * T-10 曾在此提供占位的 `stepEnemyPatrol` 随机巡逻。
 * T-11 起已由 [stepEnemyAI](./AISystem.ts#L95-L123) 完全取代 ——
 * AI 输出 `{ desiredDir, wantFire }`，调用方仍走
 * [updateTank(map, tank, dt, { forcedDir })](#L136-L162) 驱动移动，
 * 保证玩家与敌军共享同一套地形碰撞规则。
 */
