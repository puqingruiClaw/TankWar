import type { LevelDefinition } from '../types'
import { STAGE_01 } from './stage-01'

/**
 * 关卡注册表：v1 只包含 STAGE 01；后续 T-16 会补齐 5 张。
 * 单向依赖：pages / systems 通过 {@link getLevelById} 或 {@link LEVELS} 读取。
 */
export const LEVELS: readonly LevelDefinition[] = [STAGE_01]

export function getLevelById(id: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getLevelByIndex(index: number): LevelDefinition | undefined {
  return LEVELS[index]
}

export const DEFAULT_LEVEL: LevelDefinition = STAGE_01
