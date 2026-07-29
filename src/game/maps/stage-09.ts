import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 09 —— "CROSSFIRE" 十字交火
 *
 * 主题：地图中央由 steel 组成一个大十字，把地图切成 4 个象限，每个象限里
 * 有一小块 ice；十字的四端各留一格通道让玩家 / 敌军穿越。这种布局迫使
 * 玩家必须在 4 个象限之间快速切换以拦截各方向敌军；armor 从三个出生点
 * 同时压向基地时，玩家如果被卡在错误象限，基地必失。
 *
 * 教学意图：训练"火力管理与走位切换"—— 每一波都可能同时从两个 spawn
 * 涌出 armor，玩家必须选择先秒杀哪一路。ice 让走位更艰难，逼玩家把
 * 十字的四端当作"刹车安全区"。
 *
 * 难度曲线（v1.1）：basic 0 + fast 4 + power 8 + armor 8 = 20。power 数量
 * 首次追平 armor 并列第一，玩家的火力等级几乎必须维持在 lv3，否则打钢墙
 * 突进的敌军会一路直冲基地。
 *
 * 队列节奏：前 4 位 fast 让玩家措手不及，从第 5 位起 armor/power 交替
 * 无喘息；末尾 2 位 power 是通关判定点。
 *
 * 约束（validateLevel 强制）：
 * - 敌军 / 玩家出生点全 0；(6,12)=9 基地唯一；
 * - 十字通路保证 spawn → base 存在（power 打通钢墙 + 端点通道）。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 1, 1, 0, 0, 0, 2, 0, 0, 0, 1, 1, 0],
  /* r2  */ [0, 1, 5, 0, 0, 0, 2, 0, 0, 0, 5, 1, 0],
  /* r3  */ [0, 0, 0, 0, 4, 0, 2, 0, 4, 0, 0, 0, 0],
  /* r4  */ [0, 0, 0, 0, 5, 0, 2, 0, 5, 0, 0, 0, 0],
  /* r5  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r6  */ [2, 2, 2, 2, 2, 0, 0, 0, 2, 2, 2, 2, 2],
  /* r7  */ [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0],
  /* r8  */ [0, 0, 0, 0, 5, 0, 2, 0, 5, 0, 0, 0, 0],
  /* r9  */ [0, 0, 0, 0, 4, 0, 2, 0, 4, 0, 0, 0, 0],
  /* r10 */ [0, 1, 5, 0, 0, 0, 2, 0, 0, 0, 5, 1, 0],
  /* r11 */ [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'fast',
  'fast',
  'fast',
  'fast',
  'armor',
  'power',
  'armor',
  'power',
  'armor',
  'power',
  'armor',
  'power',
  'armor',
  'power',
  'armor',
  'power',
  'armor',
  'power',
  'power',
  'power',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_09] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_09: LevelDefinition = {
  id: 9,
  name: 'STAGE 09',
  tag: 'CROSSFIRE',
  hint: 'CROSS SPLITS THE MAP! SWITCH QUADRANTS FAST',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
