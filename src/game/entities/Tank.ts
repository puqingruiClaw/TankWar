/**
 * Tank 实体工厂 —— T-08 起接管 GameCanvas 里的演示方块。
 *
 * 只负责"造一个符合 {@link Tank} 结构的对象"，具体行为（移动、开火、AI）在
 * 各 system 里推进。这样保证实体本身是纯数据、方便未来做 ECS 化或跨帧序列化。
 *
 * 与 [types.ts](../types.ts) 中的 Tank interface 完全对齐。
 */

import { PLAYER_SPAWN_POINTS, TANK_COOLDOWN, TANK_HP, TANK_SPEED, TILE_SIZE } from '../constants'
import type { Direction, PlayerLevel, Tank, TankKind } from '../types'

/** 全局自增 ID，保证同一局内每个实体 id 唯一。 */
let nextEntityId = 1

export function allocEntityId(): number {
  return nextEntityId++
}

/**
 * 重置 id 计数器（仅测试用途或整局重开时调用）。
 * 生产代码请勿在游戏中途调用，会导致新旧实体 id 冲突。
 */
export function resetEntityIdForTests(): void {
  nextEntityId = 1
}

/**
 * 判定一个坦克是否属于敌军。
 * 目前实现为 `t.kind !== 'player'`，抽出来统一入口是为了：
 * - 避免在多个 system 里重复散写字符串比较；
 * - 未来接入 2P（Tank.kind='player' 但玩家阵营区分 1P/2P）或"友军 AI"时，
 *   只需改这一个函数即可保持全项目语义一致。
 */
export function isEnemyTank(t: Tank): boolean {
  return t.kind !== 'player'
}

export interface CreatePlayerTankOptions {
  /** 1P=0（默认，出生在左下）、2P=1（出生在右下）。 */
  slot?: 0 | 1
  /** 出生保护时间（秒）；默认 2s，与红白机原版一致。 */
  invulnerable?: number
  /** 初始朝向；默认朝上（面向敌军来向）。 */
  facing?: Direction
  level?: PlayerLevel
}

/** 创建玩家坦克。默认 1P，从 [PLAYER_SPAWN_POINTS[0]](../constants.ts) 出生。 */
export function createPlayerTank(options: CreatePlayerTankOptions = {}): Tank {
  const slot = options.slot ?? 0
  const spawn = PLAYER_SPAWN_POINTS[slot]
  return {
    id: allocEntityId(),
    kind: 'player',
    dir: options.facing ?? 'up',
    alive: true,
    x: spawn.col * TILE_SIZE,
    y: spawn.row * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
    hp: TANK_HP.PLAYER,
    speed: TANK_SPEED.PLAYER,
    cooldown: 0,
    level: options.level ?? 0,
    invulnerable: options.invulnerable ?? 2,
    slideRemaining: 0,
  }
}

export interface CreateEnemyTankOptions {
  kind: Exclude<TankKind, 'player'>
  col: number
  row: number
  facing?: Direction
}

/**
 * T-13 会正式接入敌军刷新流程；这里预先落地工厂，避免下个迭代再改常量表。
 * 保留但暂不使用的导出不会影响 tree-shaking，因为它是 pure function。
 */
export function createEnemyTank(options: CreateEnemyTankOptions): Tank {
  const speedMap = {
    basic: TANK_SPEED.BASIC,
    fast: TANK_SPEED.FAST,
    power: TANK_SPEED.POWER,
    armor: TANK_SPEED.ARMOR,
  } as const
  const hpMap = {
    basic: TANK_HP.BASIC,
    fast: TANK_HP.FAST,
    power: TANK_HP.POWER,
    armor: TANK_HP.ARMOR,
  } as const
  return {
    id: allocEntityId(),
    kind: options.kind,
    dir: options.facing ?? 'down',
    alive: true,
    x: options.col * TILE_SIZE,
    y: options.row * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
    hp: hpMap[options.kind],
    speed: speedMap[options.kind],
    cooldown: TANK_COOLDOWN.ENEMY,
    level: 0,
    invulnerable: 0,
    slideRemaining: 0,
  }
}
