import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 05 —— "IRON FORTRESS" 钢铁堡垒 · 一周目终关
 *
 * 主题：地图布满钢墙（2）+ 砖墙（1）构成的"米字形"迷宫，只有 power
 * 才能穿透钢墙。基地被 3×3 的钢墙 + 砖墙嵌套保护，但北方留出一条
 * 双砖厚的"献祭通道"—— 玩家守住这条通道就能守住基地。
 *
 * 教学意图：终关综合考核。冰道走位、钢墙掩体、armor 集火、power 秒杀
 * 全部同时出现；basic 完全消失、fast 只保留 2 只做变速搅局，玩家没有
 * "混子"能打，每一发子弹都要有目的。
 *
 * 难度曲线（T-16）：fast 2 + armor 8 + power 10 = 20。power 首次成为
 * 主力（50%），坦克血基本上 4~5 发才能打穿一层砖，玩家守家节奏必须
 * 缩短到 2 秒内响应。
 *
 * 队列节奏：开局 fast 打乱阵型，紧接着 armor/power 密集轰炸；末尾
 * 4 台 armor→power 是"最后 20 秒"极限压力，也是通关判定的高潮点。
 *
 * 约束（validateLevel 会强制校验）：
 * - 敌军出生点 (0,0)/(6,0)/(12,0)、玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12)=9 且全图唯一；周边多层钢墙 + 砖墙嵌套保护；
 * - 三条 spawn 列均可通过绕行 / 打通砖墙抵达 base（power 能打钢）。
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
  'power',
  'armor',
  'power',
  'armor',
  'power',
  'power',
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
  tag: 'IRON FORTRESS',
  hint: 'FINAL. KILL POWERS FIRST OR LOSE BASE',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
