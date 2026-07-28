import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 02 —— "钢墙走廊"（Steel Corridor）
 *
 * 主题：地图中轴由两列钢墙（2）夹出一条南北纵向走廊，玩家 lv<3 无法直接
 * 击穿钢墙，逼玩家 / 敌军都从东西两侧绕行。基地正上方留一条向北通的
 * "咽喉道"（brick 砖阵夹一格 grass 掩护），是攻防焦点。
 *
 * 敌军队列难度：basic(10) + fast(4) + armor(4) + power(2)，比 STAGE 01
 * 首次引入 armor/power。armor 需要 4 发才能击破，power 会打钢墙 —— 玩家
 * 必须优先清 power 以免钢墙被打穿导致侧翼失守。
 *
 * 约束校验（编码时手工核对）：
 * - 敌军出生点 (0,0)/(6,0)/(12,0) 均为 0；
 * - 玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12) = 9；
 * - 基地周边 (5,12)/(7,12)/(5,11)/(6,11)/(7,11) 由 brick 保护。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 1, 1, 0, 0, 2, 0, 2, 0, 0, 1, 1, 0],
  /* r2  */ [0, 1, 1, 0, 0, 2, 0, 2, 0, 0, 1, 1, 0],
  /* r3  */ [0, 0, 0, 1, 1, 2, 0, 2, 1, 1, 0, 0, 0],
  /* r4  */ [1, 1, 0, 1, 1, 2, 4, 2, 1, 1, 0, 1, 1],
  /* r5  */ [1, 1, 0, 0, 0, 2, 4, 2, 0, 0, 0, 1, 1],
  /* r6  */ [0, 0, 0, 3, 3, 0, 0, 0, 3, 3, 0, 0, 0],
  /* r7  */ [0, 0, 0, 3, 3, 0, 0, 0, 3, 3, 0, 0, 0],
  /* r8  */ [1, 1, 0, 0, 0, 2, 0, 2, 0, 0, 0, 1, 1],
  /* r9  */ [1, 1, 0, 1, 1, 2, 0, 2, 1, 1, 0, 1, 1],
  /* r10 */ [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
  /* r11 */ [0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'basic',
  'basic',
  'basic',
  'basic',
  'fast',
  'basic',
  'basic',
  'fast',
  'basic',
  'basic',
  'armor',
  'fast',
  'basic',
  'power',
  'basic',
  'armor',
  'fast',
  'armor',
  'power',
  'armor',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_02] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_02: LevelDefinition = {
  id: 2,
  name: 'STAGE 02',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
