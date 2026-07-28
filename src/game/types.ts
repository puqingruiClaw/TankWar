/**
 * 全局共用的运行时类型定义。
 *
 * 命名与结构对齐 [technical-architecture 5.2](../../.trae/documents/technical-architecture.md)。
 * 本文件只放"数据形状"（interface / type），行为放到对应 systems/entities 中。
 */

import type { TILE_CODE } from './constants'

// ─── 基础几何 ────────────────────────────────────────────────────────────────

/** 二维向量（像素坐标）。*/
export interface Vec2 {
  x: number
  y: number
}

/** 轴对齐包围盒（Axis-Aligned Bounding Box），碰撞检测的基本单元。*/
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 网格坐标（列、行）。*/
export interface GridPoint {
  col: number
  row: number
}

// ─── 方向 / 地形 ─────────────────────────────────────────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right'

export type TileType =
  'empty' | 'brick' | 'steel' | 'water' | 'grass' | 'ice' | 'base' | 'base-dead'

/** 关卡数值编码：TILE_CODE 各成员值构成的 union。*/
export type TileCode = (typeof TILE_CODE)[keyof typeof TILE_CODE]

// ─── 实体 ────────────────────────────────────────────────────────────────────

export type EntityId = number

/** 通用实体（继承给具体类型 Tank / Bullet / PowerUp / Explosion）。*/
export interface Entity extends Rect {
  id: EntityId
  dir: Direction
  alive: boolean
}

export type TankKind = 'player' | 'basic' | 'fast' | 'power' | 'armor'

/** 敌军坦克类型（排除 'player'），用于关卡刷新队列 / AI。 */
export type EnemyKind = Exclude<TankKind, 'player'>

/** 玩家火力等级：0 基础，1 快速，2 双弹，3 打钢。*/
export type PlayerLevel = 0 | 1 | 2 | 3

export interface Tank extends Entity {
  kind: TankKind
  hp: number
  /** 速度：像素 / 秒 */
  speed: number
  /** 距离下一次可开火剩余秒数；0 表示可以开火。*/
  cooldown: number
  /** 玩家火力等级；敌军固定为 0。*/
  level: PlayerLevel
  /** 无敌剩余时间（秒）；出生保护 / helmet 效果。*/
  invulnerable: number
  /** 结冰滑行剩余时间（秒），配合 ice 地形。*/
  slideRemaining: number
}

export interface Bullet extends Entity {
  ownerId: EntityId
  fromEnemy: boolean
  /** 1 普通、2 可击破钢（玩家 lv3 或 power 敌军）。*/
  power: 1 | 2
  /** 速度：像素 / 秒 */
  speed: number
}

export type PowerUpKind = 'star' | 'tank' | 'helmet' | 'bomb' | 'shovel' | 'clock'

export interface PowerUp extends Entity {
  kind: PowerUpKind
  /** 剩余存在时间（秒），到 0 自动消失。*/
  lifetime: number
}

/** 命中特效 / 爆炸帧动画。*/
export interface Explosion extends Entity {
  /** 剩余时间（秒）。*/
  ttl: number
  /** 帧索引；由 RenderSystem 根据 ttl 派生。*/
  frame: number
}

// ─── 关卡 ────────────────────────────────────────────────────────────────────

/** 关卡矩阵：MAP_ROWS × MAP_COLS 的 TileCode 数组。*/
export type LevelMap = TileCode[][]

export interface LevelDefinition {
  id: number
  name: string
  map: LevelMap
  /** 该关敌军类型序列（长度需等于 ENEMIES_PER_STAGE）。*/
  enemyQueue: readonly EnemyKind[]
}

// ─── 游戏状态 ────────────────────────────────────────────────────────────────

/** 顶层场景阶段。*/
export type GamePhase = 'menu' | 'stage-intro' | 'playing' | 'paused' | 'stage-clear' | 'game-over'

// ─── 输入 ────────────────────────────────────────────────────────────────────

/** 抽象化的按键动作。*/
export type InputAction = 'up' | 'down' | 'left' | 'right' | 'fire' | 'pause'

/** InputAction → 物理按键 code 的映射。*/
export type KeyBinding = Record<InputAction, string>

/** 每帧结算出的输入意图（供 MovementSystem 消费）。*/
export interface InputIntent {
  dir: Direction | null
  fire: boolean
  pausePressed: boolean
}

// ─── 数据存储 ────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  /** 3 字母大写玩家名。*/
  name: string
  score: number
  level: number
  createdAt: number
}

export interface Settings {
  /** 音量 0..1。*/
  volume: number
  muted: boolean
  keymap: KeyBinding
}
