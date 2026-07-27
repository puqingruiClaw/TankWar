/**
 * AISystem —— 敌军坦克有限状态机（FSM）。
 *
 * 对应 [technical-architecture 5.4](../../../.trae/documents/technical-architecture.md#L144-L147)：
 *
 *   Patrol → Chase → AttackBase → Retreat（可环回 Patrol）
 *
 * 触发规则（每 [AI_DECISION_INTERVAL](../constants.ts#L145) 秒重评一次）：
 * - 出生保护未过（invulnerable > 0） → 强制 Patrol；
 * - HP <= 1 且当前非 basic/fast（即 power/armor 这类"金贵"敌军） → Retreat；
 * - 玩家在 5 格曼哈顿距离内 → Chase（追玩家）；
 * - 玩家不可见但基地未毁 → AttackBase（打基地）；
 * - 其余 → Patrol（随机游荡）。
 *
 * 每状态输出一个 [AIIntent](#L60-L64) = { desiredDir, wantFire }：
 * - `desiredDir` 交给 [updateTank(map, tank, dt, { forcedDir })](./MovementSystem.ts#L136-L162)
 *   驱动移动；
 * - `wantFire` 由调用方（GameCanvas）在 [canTankFire](../entities/Bullet.ts#L58-L60)
 *   为 true 且未超 [ENEMY_MAX_BULLETS](../constants.ts#L115) 时转为
 *   [createBullet](../entities/Bullet.ts#L30-L55)。
 *
 * 教学要点：
 * - **决策与执行分离**：AISystem 只输出意图，绝不直接改 tank.x/y 或 push 子弹；
 *   这与 InputSystem 的输出结构对齐，可让 MovementSystem/BulletSystem 保持
 *   "对上层无感知"，方便未来接入回放录制。
 * - **决策节流**：直接 60fps 跑 FSM 会让敌军"每帧抽风换向"；用 AI_DECISION_INTERVAL
 *   节流后，每只敌军每秒重评 2 次，既够灵敏又能保证方向稳定。
 * - **实例私有状态外置**：AI 记忆（当前状态、决策计时器、目标方向）挂在
 *   [aiMemory](#L86-L93) Map 中，Tank 数据保持"只描述战场对象"，不越界描述行为。
 */

import { AI_DECISION_INTERVAL, MAP_COLS, MAP_ROWS, TILE_SIZE } from '../constants'
import { tileTypeAt, worldToGrid } from '../utils/grid'
import type { Direction, EntityId, LevelMap, Tank, Vec2 } from '../types'

/** FSM 四大状态。*/
export type AIState = 'patrol' | 'chase' | 'attackBase' | 'retreat'

/**
 * 每只敌军的私有记忆。放在 AISystem 内部而不是 Tank 上，是为了不污染
 * 与玩家共用的 Tank interface。生命周期由 [pruneAIMemory](#L237-L245) 维护。
 */
interface AIMemory {
  state: AIState
  /** 距下一次决策还剩多少秒；<=0 时触发重评。 */
  decisionTimer: number
  /** 当前锁定的移动方向（Patrol 时会保持一段时间，减少抖动）。 */
  currentDir: Direction
  /** Patrol 状态下，距强制换向还剩多少秒（防止朝一个方向撞死墙）。 */
  patrolHold: number
}

/** AI 每帧输出的意图，供 GameCanvas 驱动 tank + 生成子弹。 */
export interface AIIntent {
  /** 期望的移动方向；null 表示本帧不动（例如卡角）。 */
  desiredDir: Direction | null
  /** 本帧是否请求开火。 */
  wantFire: boolean
  /** 决策后确定的状态（用于调试 HUD、单元测试断言）。 */
  state: AIState
}

const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right']

/** 4 方向向量表，独立于 MovementSystem 的私有拷贝以避免循环依赖。 */
const DIR_VECTORS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** 玩家出现在这么近就切 Chase（Manhattan 距离，单位：格）。 */
const CHASE_RADIUS_TILES = 5

/**
 * AI 记忆表：EntityId → AIMemory。
 *
 * 使用 module-scope 是为了对 GameCanvas 完全隐藏 —— 上层只调
 * [stepEnemyAI](#L107-L179) 与 [pruneAIMemory](#L237-L245) 两个函数，
 * 内部状态不暴露。单实例 GameCanvas 前提下无并发风险；未来若引入多画布，
 * 需要改为实例注入 Map。
 */
const aiMemory: Map<EntityId, AIMemory> = new Map()

/**
 * 敌军坦克 AI 主入口。每帧对每只敌军调用一次。
 *
 * @param map 当前关卡地形
 * @param tank 目标敌军
 * @param dt 本帧时长（秒）
 * @param ctx 世界上下文：玩家 + 基地格坐标（若基地被毁传 null） + rng
 * @returns 本帧的 [AIIntent](#L52-L58)
 */
export function stepEnemyAI(
  map: LevelMap,
  tank: Tank,
  dt: number,
  ctx: {
    player: Tank
    basePos: { col: number; row: number } | null
    nextRandom: () => number
  },
): AIIntent {
  const memory = getOrCreateMemory(tank)
  memory.decisionTimer -= dt
  memory.patrolHold -= dt

  if (memory.decisionTimer <= 0) {
    memory.decisionTimer = AI_DECISION_INTERVAL
    memory.state = decideNextState(tank, ctx)
    memory.currentDir = decideDirection(map, tank, memory, ctx)
  } else if (memory.patrolHold <= 0 && memory.state === 'patrol') {
    // Patrol 长时间不换向可能撞墙；每 AI 决策周期内也允许 patrolHold 到点后
    // 就地再选一个方向，避免"决策周期还没到就把命耗在墙里"。
    memory.currentDir = decideDirection(map, tank, memory, ctx)
    memory.patrolHold = AI_DECISION_INTERVAL
  }

  const wantFire = shouldFire(map, tank, memory, ctx)

  return { desiredDir: memory.currentDir, wantFire, state: memory.state }
}

/** 决定下一状态。规则见文件头注释。 */
function decideNextState(
  tank: Tank,
  ctx: { player: Tank; basePos: { col: number; row: number } | null },
): AIState {
  if (tank.invulnerable > 0) return 'patrol'

  // Retreat：power/armor 型且残血；basic/fast 单血敌军不 Retreat（本来就一枪死）。
  const isTough = tank.kind === 'power' || tank.kind === 'armor'
  if (isTough && tank.hp <= 1) return 'retreat'

  if (ctx.player.alive) {
    const dist = manhattanTiles(tank, ctx.player)
    if (dist <= CHASE_RADIUS_TILES) return 'chase'
  }

  if (ctx.basePos) return 'attackBase'
  return 'patrol'
}

/**
 * 决定移动方向。策略按状态分派：
 * - patrol：随机选一个"下一格可走"的方向；
 * - chase：朝玩家的方向优先（走曼哈顿距离更大的轴）；
 * - attackBase：朝基地的方向优先；
 * - retreat：朝远离玩家的方向优先，若被卡住则退化成 patrol。
 */
function decideDirection(
  map: LevelMap,
  tank: Tank,
  memory: AIMemory,
  ctx: { player: Tank; basePos: { col: number; row: number } | null; nextRandom: () => number },
): Direction {
  const from = worldToGrid(tank.x, tank.y)
  let preferred: Direction[] = []

  switch (memory.state) {
    case 'chase': {
      const to = worldToGrid(ctx.player.x, ctx.player.y)
      preferred = dirsTowards(from, to)
      break
    }
    case 'attackBase': {
      if (ctx.basePos) preferred = dirsTowards(from, ctx.basePos)
      break
    }
    case 'retreat': {
      const to = worldToGrid(ctx.player.x, ctx.player.y)
      preferred = dirsAway(from, to)
      break
    }
    case 'patrol':
    default:
      preferred = []
  }

  // 依次尝试 preferred（可能 0~2 个），失败则从 4 个方向里排除当前方向做 shuffle 兜底。
  for (const d of preferred) {
    if (canStepInto(map, tank, d)) return d
  }

  const fallback: Direction[] = []
  for (const d of DIRS) if (d !== memory.currentDir) fallback.push(d)
  // Fisher-Yates 洗牌，保证不偏好某个方向。
  for (let i = fallback.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.nextRandom() * (i + 1))
    ;[fallback[i], fallback[j]] = [fallback[j], fallback[i]]
  }
  for (const d of fallback) if (canStepInto(map, tank, d)) return d

  // 全被围死：保持原方向（updateTank 会返回 blocked=true，坦克站桩等下一决策）。
  return memory.currentDir
}

/**
 * 是否请求开火。策略：
 * - 冷却未走完 → 不开火（canTankFire 会二次拦截，此处提前 early-return 节省判断）；
 * - Chase/AttackBase/Retreat 状态：若"当前朝向的直线视野内"能看到玩家或基地 → 开火；
 * - Patrol：偶尔（每次决策 ~20% 概率）开火，制造"随机骚扰"，接近红白机原版手感。
 */
function shouldFire(
  map: LevelMap,
  tank: Tank,
  memory: AIMemory,
  ctx: { player: Tank; basePos: { col: number; row: number } | null; nextRandom: () => number },
): boolean {
  if (tank.cooldown > 0) return false

  const dir = memory.currentDir
  const targets: Array<{ col: number; row: number }> = []
  if (ctx.player.alive) targets.push(worldToGrid(ctx.player.x, ctx.player.y))
  if (ctx.basePos) targets.push(ctx.basePos)

  for (const t of targets) {
    if (hasLineOfFire(map, tank, dir, t)) return true
  }

  // Patrol 状态下的"骚扰射击"：让敌军偶尔在没瞄准玩家时也开火。
  if (memory.state === 'patrol' && ctx.nextRandom() < 0.2) return true
  return false
}

/**
 * 沿 dir 从 tank 中心射线扫描，直到遇到硬 tile 或画布边界，
 * 中途若经过 target 所在格返回 true。
 * "硬 tile"：brick/steel/base（草地、水、冰不阻挡子弹）。
 */
function hasLineOfFire(
  map: LevelMap,
  tank: Tank,
  dir: Direction,
  target: { col: number; row: number },
): boolean {
  const from = worldToGrid(tank.x + tank.w / 2, tank.y + tank.h / 2)
  const v = DIR_VECTORS[dir]
  let col = from.col
  let row = from.row

  // 最多走整个地图对角线长度；防止死循环。
  for (let i = 0; i < MAP_COLS + MAP_ROWS; i++) {
    col += v.x
    row += v.y
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false
    if (col === target.col && row === target.row) return true
    const tile = tileTypeAt(map, col, row)
    if (tile === 'brick' || tile === 'steel' || tile === 'base') return false
  }
  return false
}

/** 判断朝 dir 走一格是否合法（下一格不是硬 tile 且在地图内）。 */
function canStepInto(map: LevelMap, tank: Tank, dir: Direction): boolean {
  const v = DIR_VECTORS[dir]
  const nextX = tank.x + v.x * TILE_SIZE
  const nextY = tank.y + v.y * TILE_SIZE
  if (nextX < 0 || nextY < 0) return false
  if (nextX + tank.w > MAP_COLS * TILE_SIZE) return false
  if (nextY + tank.h > MAP_ROWS * TILE_SIZE) return false
  // 检查目标格 & 相邻覆盖格：坦克 1×1 tile，直接看目标格是否可穿。
  const { col, row } = worldToGrid(nextX + tank.w / 2, nextY + tank.h / 2)
  const type = tileTypeAt(map, col, row)
  return type === 'empty' || type === 'grass' || type === 'ice'
}

/** 从起点朝目标的曼哈顿分量排序方向；返回 1~2 个偏好方向。 */
function dirsTowards(
  from: { col: number; row: number },
  to: { col: number; row: number },
): Direction[] {
  const dc = to.col - from.col
  const dr = to.row - from.row
  const preferred: Direction[] = []
  // 先走差距更大的那根轴，行为上"朝目标切"。
  if (Math.abs(dc) >= Math.abs(dr)) {
    if (dc !== 0) preferred.push(dc > 0 ? 'right' : 'left')
    if (dr !== 0) preferred.push(dr > 0 ? 'down' : 'up')
  } else {
    if (dr !== 0) preferred.push(dr > 0 ? 'down' : 'up')
    if (dc !== 0) preferred.push(dc > 0 ? 'right' : 'left')
  }
  return preferred
}

/** 反过来：远离目标的两个方向。 */
function dirsAway(
  from: { col: number; row: number },
  to: { col: number; row: number },
): Direction[] {
  return dirsTowards(from, to).map(reverse)
}

function reverse(d: Direction): Direction {
  return d === 'up' ? 'down' : d === 'down' ? 'up' : d === 'left' ? 'right' : 'left'
}

/** 坦克 A 与 B 的中心格坐标曼哈顿距离（单位：格）。 */
function manhattanTiles(a: Tank, b: Tank): number {
  const ap = worldToGrid(a.x + a.w / 2, a.y + a.h / 2)
  const bp = worldToGrid(b.x + b.w / 2, b.y + b.h / 2)
  return Math.abs(ap.col - bp.col) + Math.abs(ap.row - bp.row)
}

/** 首次遇到某只敌军时懒初始化其 AIMemory。 */
function getOrCreateMemory(tank: Tank): AIMemory {
  let m = aiMemory.get(tank.id)
  if (!m) {
    m = {
      state: 'patrol',
      decisionTimer: 0, // 首帧立即触发一次决策
      currentDir: tank.dir,
      patrolHold: AI_DECISION_INTERVAL,
    }
    aiMemory.set(tank.id, m)
  }
  return m
}

/**
 * 清理已死敌军的 AIMemory。调用方每帧或每次 pruneDeadEnemies 后调用一次。
 * 传入"仍存活的敌军 id 集合"，Map 中不在集合内的条目全部删除。
 */
export function pruneAIMemory(aliveIds: ReadonlySet<EntityId>): void {
  for (const id of aiMemory.keys()) {
    if (!aliveIds.has(id)) aiMemory.delete(id)
  }
}

/** 测试 / 切关卡时用：直接清空全部 AI 记忆。 */
export function resetAIMemory(): void {
  aiMemory.clear()
}
