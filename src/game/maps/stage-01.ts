import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 01 — 经典首关的 13×13 复刻：
 *
 * - 顶部留空便于敌军刷点（红白机版有 3 个 spawn point：(0,0)(6,0)(12,0)）。
 * - 中部对称砖墙 + 双钢柱 + 中央绿林掩护。
 * - 河流（water）横切中路，可挡坦克但子弹可穿。
 * - 冰面（ice）左右两块，配合 T-08 滑行手感。
 * - 底部 base（9）位于 (6,12)，周围三面砖围（BC 经典布局）。
 *
 * 数组按 [row][col] 索引；row 0 是画布最上一行。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  /* r2  */ [0, 1, 1, 0, 2, 0, 0, 0, 2, 0, 1, 1, 0],
  /* r3  */ [0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
  /* r4  */ [1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1],
  /* r5  */ [1, 1, 0, 3, 3, 0, 0, 0, 3, 3, 0, 1, 1],
  /* r6  */ [0, 0, 0, 3, 3, 0, 4, 0, 3, 3, 0, 0, 0],
  /* r7  */ [0, 5, 0, 0, 0, 0, 4, 0, 0, 0, 0, 5, 0],
  /* r8  */ [0, 5, 0, 1, 1, 0, 0, 0, 1, 1, 0, 5, 0],
  /* r9  */ [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
  /* r10 */ [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  /* r11 */ [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

/**
 * 首关敌军队列。长度必须与 [ENEMIES_PER_STAGE](../constants.ts#L119-L120) 一致（T-13 契约）。
 * 使用 `satisfies` 让 TS 保留元素字面量类型，同时下方 `if` 做运行时长度断言，
 * 防止未来手改 map 时漏掉/多写一格；生产 build 会因 ESLint no-console 而暴露。
 */
const ENEMY_QUEUE = [
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'fast',
  'fast',
  'fast',
  'fast',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
  'basic',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_01] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_01: LevelDefinition = {
  id: 1,
  name: 'STAGE 01',
  tag: 'CLASSIC',
  hint: 'MOVE WITH WASD, FIRE WITH J',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
