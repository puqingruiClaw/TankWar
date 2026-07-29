import { ENEMIES_PER_STAGE } from '../constants'
import type { EnemyKind, LevelDefinition, LevelMap } from '../types'

/**
 * STAGE 07 —— "GRASS AMBUSH" 密林伏击
 *
 * 主题：地图铺满 grass（4），子弹会穿透 grass 但视线被遮蔽——玩家看不到
 * 草丛内的敌军轮廓（RenderSystem 会绘制 grass 覆盖层）。散布的 steel 岛
 * 作为"锚点"，玩家必须靠敌军开火时的曳光弹反推位置。基地被 steel + brick
 * 双层护栏隔离，顶端留一格视觉通道以便观察威胁。
 *
 * 教学意图：一次性挑战玩家的"信息不完整"决策能力。fast 数量提高让草丛
 * 里的移动更难预判，power 保持 4 只使远射依旧致命；玩家需要用子弹反侦察。
 *
 * 难度曲线（v1.1）：basic 4 + fast 6 + power 4 + armor 6 = 20。fast 首次
 * 成为主力（30%），配合视野遮蔽会让上手感觉更慌，但击杀数不高。
 *
 * 队列节奏：前 6 位 basic/fast 密集刷屏，让草丛里满是曳光；中段 armor/power
 * 交替；末尾 3 位放 power 收束，考验残局视野管理。
 *
 * 约束（validateLevel 强制）：
 * - 敌军 / 玩家出生点全 0；(6,12)=9 基地唯一；
 * - 全图无 base_dead（初始态不允许）。
 */

// prettier-ignore
const MAP: LevelMap = [
  /* r0  */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* r1  */ [0, 4, 4, 0, 4, 4, 4, 4, 4, 0, 4, 4, 0],
  /* r2  */ [0, 4, 2, 4, 4, 2, 4, 2, 4, 4, 2, 4, 0],
  /* r3  */ [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0],
  /* r4  */ [0, 0, 4, 4, 2, 4, 4, 4, 2, 4, 4, 0, 0],
  /* r5  */ [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  /* r6  */ [4, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 4],
  /* r7  */ [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  /* r8  */ [0, 0, 4, 4, 2, 4, 4, 4, 2, 4, 4, 0, 0],
  /* r9  */ [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0],
  /* r10 */ [0, 4, 2, 4, 4, 4, 4, 4, 4, 4, 2, 4, 0],
  /* r11 */ [0, 4, 4, 0, 0, 2, 1, 2, 0, 0, 4, 4, 0],
  /* r12 */ [0, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 0, 0],
]

const ENEMY_QUEUE = [
  'fast',
  'basic',
  'fast',
  'basic',
  'fast',
  'basic',
  'fast',
  'power',
  'armor',
  'fast',
  'power',
  'armor',
  'basic',
  'armor',
  'fast',
  'armor',
  'power',
  'armor',
  'armor',
  'power',
] as const satisfies readonly EnemyKind[]

if (ENEMY_QUEUE.length !== ENEMIES_PER_STAGE) {
  throw new Error(
    `[STAGE_07] enemyQueue length ${ENEMY_QUEUE.length} !== ENEMIES_PER_STAGE (${ENEMIES_PER_STAGE})`,
  )
}

export const STAGE_07: LevelDefinition = {
  id: 7,
  name: 'STAGE 07',
  tag: 'GRASS AMBUSH',
  hint: 'GRASS HIDES TANKS! WATCH THE TRACERS',
  map: MAP,
  enemyQueue: ENEMY_QUEUE,
}
