import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 03 —— "FROZEN LAKE" 冰湖战场
 *
 * 主题：地图中心大片冰面（5）覆盖 5×5 核心区，坦克走上去会有惯性滑行
 * （由 MovementSystem 的 ice 处理），瞄准变得极难。四角设置 brick 掩体
 * 供玩家躲避，外圈用 grass 遮蔽视野。基地被两圈砖墙包夹保护更强。
 *
 * 教学意图：让玩家学会"在滑动中控枪"——冰面惯性 + 快速敌军 + 少量 power
 * 组合出手忙脚乱的临场感，倒逼玩家提前预判并利用钢墙做刹车掩体。
 *
 * 难度曲线（T-16）：basic 8 + fast 8 + armor 2 + power 2 = 20。armor 数量
 * 仍与 02 持平；power 首次登场（会打钢墙 → 敌军能击穿基地周边砖），只放
 * 2 只让玩家先适应"必须优先秒杀 power"的思维。
 *
 * 队列节奏：开局 fast/basic 交替让玩家先适应冰面惯性；第 10、17 位分别
 * 埋 power，用 basic/fast 稀释密度避免同屏两 power 双爆基地。
 *
 * 约束（validateLevel 会强制校验）：
 * - 敌军出生点 (0,0)/(6,0)/(12,0)、玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12)=9 且全图唯一；(5,12)/(7,12)/(6,11) 由 brick 保护。
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
  'basic',
  'fast',
  'basic',
  'fast',
  'basic',
  'fast',
  'armor',
  'power',
  'basic',
  'fast',
  'basic',
  'fast',
  'basic',
  'fast',
  'armor',
  'power',
  'basic',
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
  tag: 'FROZEN LAKE',
  hint: 'ICE = SLIDE! AIM AHEAD OF ENEMIES',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
