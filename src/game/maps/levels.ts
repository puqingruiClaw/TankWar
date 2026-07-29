import {
  BASE_POSITION,
  ENEMIES_PER_STAGE,
  ENEMY_SPAWN_POINTS,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_SPAWN_POINTS,
  TILE_CODE,
} from '../constants'
import type { EnemyKind, LevelDefinition, TileCode } from '../types'
import { STAGE_01 } from './stage-01'
import { STAGE_02 } from './stage-02'
import { STAGE_03 } from './stage-03'
import { STAGE_04 } from './stage-04'
import { STAGE_05 } from './stage-05'
import { STAGE_06 } from './stage-06'
import { STAGE_07 } from './stage-07'
import { STAGE_08 } from './stage-08'
import { STAGE_09 } from './stage-09'
import { STAGE_10 } from './stage-10'

/**
 * 关卡注册表：T-15 起补齐首批 5 张；v1.1 (T-28) 追加 06~10 达到 10 关。
 * 顺序即"关卡推进顺序"：PlayPage 用 levelIndex 逐 +1 前进，走完最后一关
 * 触发 GAME COMPLETE。若后续要做二周目 / 无限模式，只需在此追加或引入
 * "关卡循环策略"。
 *
 * 单向依赖：pages / systems 通过 {@link getLevelById} 或 {@link LEVELS} 读取。
 */
export const LEVELS: readonly LevelDefinition[] = [
  STAGE_01,
  STAGE_02,
  STAGE_03,
  STAGE_04,
  STAGE_05,
  STAGE_06,
  STAGE_07,
  STAGE_08,
  STAGE_09,
  STAGE_10,
]

export function getLevelById(id: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getLevelByIndex(index: number): LevelDefinition | undefined {
  return LEVELS[index]
}

/** 首关，用于 GameCanvas 默认 prop / 冷启动 fallback。 */
export const DEFAULT_LEVEL: LevelDefinition = STAGE_01

/** 一周目总关数（PlayPage HUD "STAGE xx / TOTAL" 用）。 */
export const TOTAL_STAGES: number = LEVELS.length

/**
 * 关卡 id → hint 快查表（T-16）。PlayPage HUD "STAGE HINT" 行使用。
 * 未定义 hint 的关会返回 undefined，UI 层需容忍并隐藏该行。
 */
export const STAGE_HINTS: Readonly<Record<number, string | undefined>> = LEVELS.reduce(
  (acc, lv) => {
    acc[lv.id] = lv.hint
    return acc
  },
  {} as Record<number, string | undefined>,
)

// ─── 关卡静态校验（T-16） ───────────────────────────────────────────────────────
// 每次 `import` 本文件时对全部 LEVELS 跑一次；任何违反关卡契约的地图会在
// 模块加载阶段直接抛错，让 dev/prod 冷启动第一时间发现，而不是运行到那关才崩。
// 单次开销 O(5 × 13 × 13) ≈ 845 次比较，可忽略。

/** 合法 TileCode 值集合。 */
const VALID_TILE_CODES: ReadonlySet<TileCode> = new Set([
  TILE_CODE.EMPTY,
  TILE_CODE.BRICK,
  TILE_CODE.STEEL,
  TILE_CODE.WATER,
  TILE_CODE.GRASS,
  TILE_CODE.ICE,
  TILE_CODE.BASE_DEAD,
  TILE_CODE.BASE,
])

/** 合法敌军类型集合（与 EnemyKind union 保持同源）。 */
const VALID_ENEMY_KINDS: ReadonlySet<EnemyKind> = new Set<EnemyKind>([
  'basic',
  'fast',
  'power',
  'armor',
])

/**
 * 关卡合法性校验：
 * 1) 地图尺寸严格 MAP_ROWS × MAP_COLS；
 * 2) 每一格都在 VALID_TILE_CODES 内；
 * 3) 基地 (6,12) 必须为 BASE，其它格不得再出现 BASE / BASE_DEAD；
 * 4) 敌军刷新点 (0,0)/(6,0)/(12,0) 与玩家出生点 (4,12)/(8,12) 必须为 EMPTY；
 * 5) enemyQueue 长度 == ENEMIES_PER_STAGE，且每项都是合法 EnemyKind。
 *
 * 校验失败会抛出带关卡 id/name 的 Error，方便一眼定位问题地图。
 */
export function validateLevel(level: LevelDefinition): void {
  const tag = `[LEVEL ${level.id} "${level.name}"]`

  // 1) 尺寸
  if (level.map.length !== MAP_ROWS) {
    throw new Error(`${tag} map rows = ${level.map.length}, expected ${MAP_ROWS}`)
  }
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = level.map[row]
    if (line.length !== MAP_COLS) {
      throw new Error(`${tag} row ${row} length = ${line.length}, expected ${MAP_COLS}`)
    }
    // 2) 合法 tile code
    for (let col = 0; col < MAP_COLS; col++) {
      const code = line[col]
      if (!VALID_TILE_CODES.has(code)) {
        throw new Error(`${tag} invalid tile code ${code} at (col=${col}, row=${row})`)
      }
    }
  }

  // 3) 基地位置唯一且正确
  let baseCount = 0
  let baseDeadCount = 0
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const code = level.map[row][col]
      if (code === TILE_CODE.BASE) baseCount++
      if (code === TILE_CODE.BASE_DEAD) baseDeadCount++
    }
  }
  if (baseCount !== 1) {
    throw new Error(`${tag} expected exactly 1 BASE tile, got ${baseCount}`)
  }
  if (baseDeadCount !== 0) {
    throw new Error(`${tag} initial map must not contain BASE_DEAD tiles (got ${baseDeadCount})`)
  }
  const baseHere = level.map[BASE_POSITION.row][BASE_POSITION.col]
  if (baseHere !== TILE_CODE.BASE) {
    throw new Error(
      `${tag} BASE tile must be at (col=${BASE_POSITION.col}, row=${BASE_POSITION.row}), got code ${baseHere} there`,
    )
  }

  // 4) spawn 点必须为 EMPTY，否则 SpawnManager 会一直找不到落点
  const spawnChecks: { label: string; points: readonly { col: number; row: number }[] }[] = [
    { label: 'enemy-spawn', points: ENEMY_SPAWN_POINTS },
    { label: 'player-spawn', points: PLAYER_SPAWN_POINTS },
  ]
  for (const { label, points } of spawnChecks) {
    for (const p of points) {
      const code = level.map[p.row][p.col]
      if (code !== TILE_CODE.EMPTY) {
        throw new Error(
          `${tag} ${label} (col=${p.col}, row=${p.row}) must be EMPTY, got code ${code}`,
        )
      }
    }
  }

  // 5) enemyQueue 结构
  if (level.enemyQueue.length !== ENEMIES_PER_STAGE) {
    throw new Error(
      `${tag} enemyQueue length ${level.enemyQueue.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
    )
  }
  for (let i = 0; i < level.enemyQueue.length; i++) {
    const k = level.enemyQueue[i]
    if (!VALID_ENEMY_KINDS.has(k)) {
      throw new Error(`${tag} enemyQueue[${i}] invalid EnemyKind: ${String(k)}`)
    }
  }
}

// 模块加载即校验：任何一张地图出错都会在 import LEVELS 时立即暴露。
for (const lv of LEVELS) validateLevel(lv)
