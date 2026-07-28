import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 04 —— "水系分割"（River Delta）
 *
 * 主题：三条水路（3）把地图切成上下三段，上段是敌军出生区、中段是缓冲带、
 * 下段是玩家防守区。水路留有 3 处"过河点"（col 2/6/10），玩家 / 敌军都
 * 必须走这几个位置对峙。基地正上方留一整列 grass 作为最后的视觉遮蔽。
 *
 * 敌军队列难度：混合 armor(6) + power(5) —— armor 硬肉 + power 打钢墙，
 * 玩家要在过河点建立"绞肉据点"，否则会被 power 从远处击穿砖墙打基地。
 *
 * 约束校验：
 * - 敌军出生点 (0,0)/(6,0)/(12,0) 均为 0；
 * - 玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12) = 9；(5,12)/(7,12)/(6,11) 均为 brick；
 * - 水路留过河点：(row=3,col=2/6/10)、(row=6,col=2/6/10)、(row=9,col=2/6/10)
 *   处为 empty，保证敌军能到达底部。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 1, 1, 0, 2, 0, 0, 0, 2, 0, 1, 1, 0],
  /* r2  */ [0, 1, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 0],
  /* r3  */ [3, 3, 0, 3, 3, 3, 0, 3, 3, 3, 0, 3, 3],
  /* r4  */ [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
  /* r5  */ [0, 1, 0, 2, 0, 1, 4, 1, 0, 2, 0, 1, 0],
  /* r6  */ [3, 3, 0, 3, 3, 0, 4, 0, 3, 3, 0, 3, 3],
  /* r7  */ [0, 1, 0, 2, 0, 1, 4, 1, 0, 2, 0, 1, 0],
  /* r8  */ [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
  /* r9  */ [3, 3, 0, 3, 3, 3, 0, 3, 3, 3, 0, 3, 3],
  /* r10 */ [0, 0, 0, 1, 1, 4, 4, 4, 1, 1, 0, 0, 0],
  /* r11 */ [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'basic',
  'armor',
  'basic',
  'power',
  'armor',
  'basic',
  'armor',
  'power',
  'basic',
  'armor',
  'power',
  'fast',
  'armor',
  'power',
  'basic',
  'armor',
  'fast',
  'power',
  'armor',
  'power',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_04] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_04: LevelDefinition = {
  id: 4,
  name: 'STAGE 04',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
