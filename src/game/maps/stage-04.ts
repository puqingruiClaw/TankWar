import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 04 —— "RIVER DELTA" 水系分割
 *
 * 主题：三条水路（3）把地图切成上下三段，上段是敌军出生区、中段是缓冲带、
 * 下段是玩家防守区。水路留有 3 处"过河点"（col 2/6/10），玩家 / 敌军都
 * 必须走这几个位置对峙。基地正上方留一整列 grass 作为最后的视觉遮蔽。
 *
 * 教学意图：让玩家学会"卡瓶颈"—— 3 个固定过河点意味着守家不再靠机动，
 * 而是靠占位；armor 大量登场也逼玩家学会集中火力秒杀而非游走对射。
 *
 * 难度曲线（T-16）：basic 4 + fast 4 + armor 8 + power 4 = 20。armor
 * 首次成为主力（8/20，占 40%），玩家单发子弹已经打不动了，必须持续
 * 压枪或双人夹击。power 数量翻倍到 4，配合水路让远射变得极致关键。
 *
 * 队列节奏：开局 basic/fast 让玩家先摸清过河点位；从第 5 位起 armor
 * 密度陡增；power 均匀分布在 4/9/14/19 位，避免"末尾 4 power 同屏"。
 *
 * 约束（validateLevel 会强制校验）：
 * - 敌军出生点 (0,0)/(6,0)/(12,0)、玩家出生点 (4,12)/(8,12) 均为 0；
 * - 基地 (6,12)=9 且全图唯一；
 * - 水路留过河点：(row=3,col=2/6/10)、(row=6,col=2/6/10)、(row=9,col=2/6/10)
 *   处为 empty，保证从 spawn 到 base 存在贯通路径。
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
  'fast',
  'basic',
  'power',
  'armor',
  'fast',
  'armor',
  'basic',
  'power',
  'armor',
  'fast',
  'armor',
  'fast',
  'power',
  'armor',
  'basic',
  'armor',
  'armor',
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
  tag: 'RIVER DELTA',
  hint: 'HOLD THE 3 CROSSINGS! ARMOR TAKES 4 HITS',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
