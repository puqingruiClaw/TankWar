import type { LevelDefinition } from '../types'
import { STAGE_01 } from './stage-01'
import { STAGE_02 } from './stage-02'
import { STAGE_03 } from './stage-03'
import { STAGE_04 } from './stage-04'
import { STAGE_05 } from './stage-05'

/**
 * 关卡注册表：T-15 起补齐全部 5 张（一周目）。
 * 顺序即"关卡推进顺序"：PlayPage 用 levelIndex 逐 +1 前进，走完最后一关
 * 触发 GAME COMPLETE。若后续要做二周目 / 无限模式，只需在此追加或引入
 * "关卡循环策略"。
 *
 * 单向依赖：pages / systems 通过 {@link getLevelById} 或 {@link LEVELS} 读取。
 */
export const LEVELS: readonly LevelDefinition[] = [STAGE_01, STAGE_02, STAGE_03, STAGE_04, STAGE_05]

export function getLevelById(id: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getLevelByIndex(index: number): LevelDefinition | undefined {
  return LEVELS[index]
}

/** 首关，用于 GameCanvas 默认 prop / 冷启动 fallback。 */
export const DEFAULT_LEVEL: LevelDefinition = STAGE_01

/** 一周目总关数（PlayPage HUD "STAGE xx / TOTAL" 用）。 */
export const TOTAL_STAGES: number = LEVELS.length
