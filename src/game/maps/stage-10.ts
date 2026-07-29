import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 10 —— "OMEGA" 二周目终关
 *
 * 主题：把 6 种地形（brick / steel / water / grass / ice / base）**全部**塞
 * 进同一张图，且互相咬合形成"综合考试"—— 上路水系分割、中路草林伏击、
 * 下路冰面 + 钢柱掩体、基地被 3×3 钢墙 + 双砖门户封死，只在正上方留一格
 * 视觉窗口。整张图的每一寸都在惩罚"惯性走位"。
 *
 * 教学意图：v1.1 的最终 boss 关。玩家如果能在 60 秒内解决 12 只 power，
 * 基本可以证明整套机制已经完全掌握。此关不再教新东西，只做综合考核。
 *
 * 难度曲线（v1.1）：basic 0 + fast 2 + power 12 + armor 6 = 20。power 首次
 * 突破 50% 占比（是 05 终关的 1.2 倍），玩家必须一直保持 lv3 火力，否则
 * power 敌军会在 10 秒内把基地北面砖墙全部打穿。
 *
 * 队列节奏：开局 2 fast 打乱阵型；接着 power 密集轰炸（第 3~14 位有 8 只
 * power），armor 均匀分布做保底；末尾 3 位 power 是通关判定点。
 *
 * 约束（validateLevel 强制）：
 * - 敌军 / 玩家出生点全 0；(6,12)=9 基地唯一；
 * - 基地上方存在贯通路径（power 破砖 / 绕行钢墙均可）。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 3, 3, 0, 4, 4, 0, 4, 4, 0, 3, 3, 0],
  /* r2  */ [0, 3, 3, 0, 4, 4, 0, 4, 4, 0, 3, 3, 0],
  /* r3  */ [0, 0, 0, 1, 1, 0, 4, 0, 1, 1, 0, 0, 0],
  /* r4  */ [4, 4, 0, 1, 5, 5, 4, 5, 5, 1, 0, 4, 4],
  /* r5  */ [4, 4, 0, 0, 5, 2, 2, 2, 5, 0, 0, 4, 4],
  /* r6  */ [0, 2, 2, 0, 5, 2, 0, 2, 5, 0, 2, 2, 0],
  /* r7  */ [0, 2, 2, 0, 5, 2, 4, 2, 5, 0, 2, 2, 0],
  /* r8  */ [4, 4, 0, 0, 5, 2, 2, 2, 5, 0, 0, 4, 4],
  /* r9  */ [4, 4, 0, 1, 5, 5, 4, 5, 5, 1, 0, 4, 4],
  /* r10 */ [0, 0, 0, 1, 1, 0, 2, 0, 1, 1, 0, 0, 0],
  /* r11 */ [0, 3, 3, 0, 0, 2, 1, 2, 0, 0, 3, 3, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'fast',
  'fast',
  'power',
  'armor',
  'power',
  'power',
  'armor',
  'power',
  'power',
  'armor',
  'power',
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
    `[STAGE_10] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_10: LevelDefinition = {
  id: 10,
  name: 'STAGE 10',
  tag: 'OMEGA',
  hint: 'FINAL EXAM. KEEP LV3 OR LOSE THE EAGLE',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
