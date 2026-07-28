import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 05 —— "钢铁堡垒"（Iron Fortress） · 一周目终关
 *
 * 主题：地图布满钢墙（2）+ 砖墙（1）构成的"米字形"迷宫，只有 power
 * 才能穿透钢墙。基地被 3×3 的钢墙 + 砖墙嵌套保护，但北方留出一条
 * 双砖厚的"献祭通道"—— 玩家守住这条通道就能守住基地。
 *
 * 敌军队列难度：终关强度 —— armor(8) + power(8) + fast(4)，无 basic。
 * armor 需要 400 分击破且血厚，power 打钢墙也高伤，玩家必须充分利用
 * 冰道的滑行 + 钢墙掩体走位。
 *
 * 约束校验：
 * - 敌军出生点 (0,0)/(6,0)/(12,0) 均为 0；
 * - 玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12) = 9；周边 (5,12)/(7,12)/(5,11)/(6,11)/(7,11) 均为 brick；
 * - 外圈再套一层钢墙 (5,10)/(6,10)/(7,10) 提升守家难度。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 2, 2, 0, 1, 1, 0, 1, 1, 0, 2, 2, 0],
  /* r2  */ [0, 2, 2, 0, 1, 1, 0, 1, 1, 0, 2, 2, 0],
  /* r3  */ [0, 0, 0, 5, 5, 0, 4, 0, 5, 5, 0, 0, 0],
  /* r4  */ [1, 1, 0, 5, 5, 2, 2, 2, 5, 5, 0, 1, 1],
  /* r5  */ [1, 1, 0, 0, 0, 2, 0, 2, 0, 0, 0, 1, 1],
  /* r6  */ [0, 3, 3, 0, 1, 0, 4, 0, 1, 0, 3, 3, 0],
  /* r7  */ [0, 3, 3, 0, 1, 0, 0, 0, 1, 0, 3, 3, 0],
  /* r8  */ [1, 1, 0, 0, 0, 2, 0, 2, 0, 0, 0, 1, 1],
  /* r9  */ [1, 1, 0, 5, 5, 2, 2, 2, 5, 5, 0, 1, 1],
  /* r10 */ [0, 0, 0, 5, 5, 2, 2, 2, 5, 5, 0, 0, 0],
  /* r11 */ [0, 2, 2, 0, 0, 1, 1, 1, 0, 0, 2, 2, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'fast',
  'armor',
  'power',
  'armor',
  'power',
  'fast',
  'armor',
  'power',
  'armor',
  'power',
  'fast',
  'armor',
  'power',
  'armor',
  'power',
  'fast',
  'armor',
  'power',
  'armor',
  'power',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_05] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_05: LevelDefinition = {
  id: 5,
  name: 'STAGE 05',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
