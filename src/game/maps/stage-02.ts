import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 02 —— "STEEL CORRIDOR" 钢墙走廊
 *
 * 主题：地图中轴由两列钢墙（2）夹出一条南北纵向走廊，玩家 lv<3 无法直接
 * 击穿钢墙，逼玩家 / 敌军都从东西两侧绕行。基地正上方留一条向北通的
 * "咽喉道"（brick 砖阵夹一格 grass 掩护），是攻防焦点。
 *
 * 教学意图：让玩家第一次遇到"打不穿的墙"（钢），学会绕行 + 侧翼卡位。
 *
 * 难度曲线（T-16）：basic 12 + fast 6 + armor 2 = 20。首次引入 armor（4HP，
 * 需 4 发才能击破），但**不给 power**——让玩家先熟悉"耐打型敌军"，把 power
 * 留到 STAGE 03 配合冰面滑行做二段升级。
 *
 * 队列节奏：前 8 只全 basic 让玩家进入状态；中段 fast 冲刺；armor 藏在
 * 12/16 位，避免出场即被围杀，也避免全在末尾变成"最后卡关"。
 *
 * 约束（validateLevel 会强制校验）：
 * - 敌军出生点 (0,0)/(6,0)/(12,0)、玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12)=9 且全图唯一；
 * - spawn (6,0) 沿中路走廊可直达基地（(6,4)/(6,5) 是 grass 视觉遮蔽而非阻挡）。
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
  'basic',
  'basic',
  'basic',
  'basic',
  'fast',
  'fast',
  'basic',
  'armor',
  'fast',
  'fast',
  'basic',
  'basic',
  'armor',
  'fast',
  'fast',
  'basic',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_02] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_02: LevelDefinition = {
  id: 2,
  name: 'STAGE 02',
  tag: 'STEEL CORRIDOR',
  hint: 'STEEL BLOCKS BULLETS UNTIL LV3',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
