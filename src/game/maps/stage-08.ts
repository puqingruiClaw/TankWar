import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 08 —— "TWIN FEINT" 双诱饵基地
 *
 * 主题：地图左右两侧各布一组"看起来像基地"的砖围（brick 环 + steel 加固），
 * 视觉上极易与真基地混淆；但契约上基地位置仍必须是 (6,12)（validateLevel 硬性
 * 要求全图唯一 base tile），所以左右两组只是**假的砖砌障碍**，用于误导 AI
 * 与新手玩家。armor 敌军会优先攻击这些"假基地"，为玩家争取喘息时间；power
 * 则会直接冲真基地，玩家必须能一眼分辨。
 *
 * 教学意图：训练"目标识别"—— 玩家要学会看颜色识真伪、跟着 HUD 提示走。
 * 也是终关 (10) 之前最后一次"新玩法引入"，为终关铺垫多目标决策。
 *
 * 难度曲线（v1.1）：basic 2 + fast 4 + power 6 + armor 8 = 20。power 数量首次
 * 追平 armor（30%），玩家已经不能再依赖"打钢墙"作为回避手段。
 *
 * 队列节奏：末尾 4 位是 armor/power 交替，是"最后 30 秒"的爆炸性输出。
 *
 * 约束（validateLevel 强制）：
 * - 敌军 / 玩家出生点全 0；(6,12)=9 基地唯一；
 * - 左右两组"假基地"仅由 brick + steel 构成，不含 9 / 8。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0],
  /* r2  */ [0, 2, 2, 0, 0, 4, 2, 4, 0, 0, 2, 2, 0],
  /* r3  */ [0, 2, 1, 0, 0, 4, 4, 4, 0, 0, 1, 2, 0],
  /* r4  */ [0, 2, 2, 0, 3, 3, 0, 3, 3, 0, 2, 2, 0],
  /* r5  */ [0, 0, 0, 0, 3, 3, 4, 3, 3, 0, 0, 0, 0],
  /* r6  */ [1, 1, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 1],
  /* r7  */ [1, 1, 0, 0, 3, 3, 4, 3, 3, 0, 0, 1, 1],
  /* r8  */ [0, 0, 0, 0, 3, 3, 0, 3, 3, 0, 0, 0, 0],
  /* r9  */ [0, 2, 2, 0, 0, 4, 4, 4, 0, 0, 2, 2, 0],
  /* r10 */ [0, 2, 1, 0, 0, 4, 2, 4, 0, 0, 1, 2, 0],
  /* r11 */ [0, 2, 2, 0, 0, 1, 1, 1, 0, 0, 2, 2, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'fast',
  'basic',
  'armor',
  'power',
  'fast',
  'armor',
  'power',
  'basic',
  'armor',
  'power',
  'fast',
  'armor',
  'power',
  'armor',
  'fast',
  'power',
  'armor',
  'armor',
  'power',
  'armor',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_08] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_08: LevelDefinition = {
  id: 8,
  name: 'STAGE 08',
  tag: 'TWIN FEINT',
  hint: 'FAKE BASES ON FLANKS! CENTER IS REAL',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
