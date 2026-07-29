import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 06 —— "LABYRINTH" 砖块迷宫
 *
 * 主题：地图被高密度 brick（1）分成 3×3 的九宫格，每格中心留一小片 ice（5）
 * 制造"过格瞬间失控"的紧张感。基地由砖 + 一层 steel 双层护栏包裹，正上方
 * 留一条竖直"死亡通道"—— 这条通道是 AI 的最短路径，也是玩家必须堵住的点。
 *
 * 教学意图：一周目终关（05）之后玩家已掌握所有机制；06 换个玩法，把重点
 * 从"火力压制"改成"路径预判"——网格越密，AI BFS 越常选择破墙抄近道，
 * 玩家需要主动打通友军路径 / 堵敌军路径。
 *
 * 难度曲线（v1.1）：basic 6 + fast 4 + power 4 + armor 6 = 20。armor+power
 * 占比刻意降到 50%，作为 05 终关后的"喘息关"，避免六连击紧压导致挫败。
 *
 * 队列节奏：basic/fast 开局稀释密度，让玩家熟悉迷宫走位；armor/power 从
 * 第 8 位起交替登场，直到末尾 3 位连续 armor 收束。
 *
 * 约束（validateLevel 强制）：
 * - 敌军出生点 (0,0)/(6,0)/(12,0)、玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12)=9 且全图唯一；(5,12)/(7,12)/(6,11) 由 steel 保护。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  /* r2  */ [0, 1, 5, 1, 0, 1, 5, 1, 0, 1, 5, 1, 0],
  /* r3  */ [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  /* r4  */ [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0],
  /* r5  */ [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  /* r6  */ [0, 1, 5, 1, 0, 1, 5, 1, 0, 1, 5, 1, 0],
  /* r7  */ [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  /* r8  */ [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0],
  /* r9  */ [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  /* r10 */ [0, 1, 5, 1, 0, 1, 5, 1, 0, 1, 5, 1, 0],
  /* r11 */ [0, 1, 1, 1, 0, 2, 1, 2, 0, 1, 1, 1, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'basic',
  'fast',
  'basic',
  'fast',
  'basic',
  'fast',
  'basic',
  'power',
  'armor',
  'basic',
  'power',
  'fast',
  'armor',
  'power',
  'armor',
  'power',
  'basic',
  'armor',
  'armor',
  'armor',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_06] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_06: LevelDefinition = {
  id: 6,
  name: 'STAGE 06',
  tag: 'LABYRINTH',
  hint: 'NARROW LANES: BREAK WALLS TO OUTFLANK',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
