import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 03 —— "冰湖战场"（Frozen Lake）
 *
 * 主题：地图中心大片冰面（5）覆盖 5×5 核心区，坦克走上去会有惯性滑行
 * （由 MovementSystem 的 ice 处理），瞄准变得极难。四角设置 brick 掩体
 * 供玩家躲避，外圈用 grass 遮蔽视野。基地被两圈砖墙包夹保护更强。
 *
 * 敌军队列难度：以 fast(9) 为主 —— 冰面 + 快速敌军是最刺激的组合；
 * 混入 4 台 power 会打钢墙也能击破基地周边砖，玩家要抢时间清场。
 *
 * 约束校验：
 * - 敌军出生点 (0,0)/(6,0)/(12,0) 均为 0；
 * - 玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12) = 9；(5,12)/(7,12) 均为 brick；(6,11)=brick。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 4, 4, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0],
  /* r2  */ [0, 4, 4, 0, 1, 1, 0, 1, 1, 0, 4, 4, 0],
  /* r3  */ [0, 0, 0, 0, 5, 5, 5, 5, 5, 0, 0, 0, 0],
  /* r4  */ [0, 1, 0, 5, 5, 5, 5, 5, 5, 5, 0, 1, 0],
  /* r5  */ [0, 1, 0, 5, 5, 2, 0, 2, 5, 5, 0, 1, 0],
  /* r6  */ [0, 0, 0, 5, 5, 0, 0, 0, 5, 5, 0, 0, 0],
  /* r7  */ [0, 1, 0, 5, 5, 2, 0, 2, 5, 5, 0, 1, 0],
  /* r8  */ [0, 1, 0, 5, 5, 5, 5, 5, 5, 5, 0, 1, 0],
  /* r9  */ [0, 0, 0, 0, 5, 5, 5, 5, 5, 0, 0, 0, 0],
  /* r10 */ [0, 4, 4, 0, 1, 1, 0, 1, 1, 0, 4, 4, 0],
  /* r11 */ [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'basic',
  'fast',
  'fast',
  'basic',
  'fast',
  'fast',
  'basic',
  'fast',
  'fast',
  'power',
  'fast',
  'fast',
  'power',
  'basic',
  'fast',
  'power',
  'fast',
  'basic',
  'power',
  'fast',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_03] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_03: LevelDefinition = {
  id: 3,
  name: 'STAGE 03',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
