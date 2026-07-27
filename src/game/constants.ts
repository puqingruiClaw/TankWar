/**
 * 游戏全局常量。
 *
 * 所有像素相关的常量都以 {@link TILE_SIZE} 为基准派生，
 * 请勿在业务代码里出现魔法数字 32 / 13 / 416，一律 import 常量。
 *
 * 参考文档：
 * - [PRD 4.1](./../../.trae/documents/prd.md) —— 视觉规范
 * - [technical-architecture 5.x](./../../.trae/documents/technical-architecture.md) —— 数值与规则
 */

// ─── 画布 / 网格 ──────────────────────────────────────────────────────────────

/** 单格像素尺寸。所有实体的宽高、位移速度都以 TILE_SIZE 为基础。*/
export const TILE_SIZE = 32

/** 关卡地图列数（横向格数）。*/
export const MAP_COLS = 13

/** 关卡地图行数（纵向格数）。*/
export const MAP_ROWS = 13

/** 战斗画布像素宽度 = MAP_COLS × TILE_SIZE = 416。*/
export const CANVAS_WIDTH = MAP_COLS * TILE_SIZE

/** 战斗画布像素高度 = MAP_ROWS × TILE_SIZE = 416。*/
export const CANVAS_HEIGHT = MAP_ROWS * TILE_SIZE

/** 舞台总宽度（画布 + HUD），对应 Tailwind spacing.stage。*/
export const STAGE_WIDTH = 640

/** 舞台总高度，对应 Tailwind spacing.stage-h。*/
export const STAGE_HEIGHT = 480

/** HUD 侧栏宽度（与 Tailwind spacing.hud 保持一致）。*/
export const HUD_WIDTH = 224

// ─── 帧率 / 时序 ──────────────────────────────────────────────────────────────

/** 逻辑目标帧率。*/
export const FPS = 60

/** 固定逻辑步长（秒）。GameEngine 通过累加时间片调用逻辑更新。*/
export const FIXED_DT = 1 / FPS

/** 单帧允许积累的最大逻辑步数，防止长阻塞后死循环追帧。*/
export const MAX_STEPS_PER_FRAME = 5

// ─── 地形数值编码 ────────────────────────────────────────────────────────────
// 关卡文件用二维数字数组存放地形，编码与 technical-architecture 5.5 保持一致：
// 0 空 / 1 砖 / 2 钢 / 3 水 / 4 草 / 5 冰 / 9 基地

/** 关卡数据中的地形数值编码。*/
export const TILE_CODE = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  GRASS: 4,
  ICE: 5,
  BASE: 9,
} as const

/**
 * 地形编码 → 语义 tile 名称。
 * TILE_CODE 与 TileType 的双向映射，运行时按需读取；避免 switch 语句散落。
 */
export const TILE_CODE_TO_TYPE = {
  [TILE_CODE.EMPTY]: 'empty',
  [TILE_CODE.BRICK]: 'brick',
  [TILE_CODE.STEEL]: 'steel',
  [TILE_CODE.WATER]: 'water',
  [TILE_CODE.GRASS]: 'grass',
  [TILE_CODE.ICE]: 'ice',
  [TILE_CODE.BASE]: 'base',
} as const

// ─── 速度（像素 / 秒） ───────────────────────────────────────────────────────
// 参考经典红白机手感：玩家 3 tiles/s ≈ 96 px/s；子弹是坦克 3~4 倍速。

export const TANK_SPEED = {
  PLAYER: 96,
  BASIC: 64,
  FAST: 128,
  POWER: 96,
  ARMOR: 64,
} as const

export const BULLET_SPEED = {
  NORMAL: 240,
  FAST: 320,
} as const

// ─── 坦克与子弹参数 ──────────────────────────────────────────────────────────

/** 各种坦克默认 HP。玩家默认 1，捡到 helmet 后短时无敌，另行处理。*/
export const TANK_HP = {
  PLAYER: 1,
  BASIC: 1,
  FAST: 1,
  POWER: 1,
  ARMOR: 4,
} as const

/** 坦克开火冷却（秒）。*/
export const TANK_COOLDOWN = {
  PLAYER: 0.25,
  ENEMY: 0.9,
} as const

/** 玩家最大同屏子弹数（初始 1，升级到 lv2+ 变为 2）。*/
export const PLAYER_MAX_BULLETS = 2

/** 敌军单坦克同屏最多子弹数。*/
export const ENEMY_MAX_BULLETS = 1

// ─── 生成 / 关卡 ─────────────────────────────────────────────────────────────

/** 一关默认敌军总数（红白机原版为 20）。*/
export const ENEMIES_PER_STAGE = 20

/** 战场同屏最多同时存在的敌军数量。*/
export const MAX_ENEMIES_ON_FIELD = 4

/** 敌军刷新点（用格坐标，左上/中上/右上），与 PRD 4.1 一致。*/
export const ENEMY_SPAWN_POINTS = [
  { col: 0, row: 0 },
  { col: 6, row: 0 },
  { col: 12, row: 0 },
] as const

/** 玩家出生点（P1 位于 MAP 底部靠左 3 格；P2 靠右 3 格，二人模式使用）。*/
export const PLAYER_SPAWN_POINTS = [
  { col: 4, row: 12 },
  { col: 8, row: 12 },
] as const

/** 基地位置（底部中央）。*/
export const BASE_POSITION = { col: 6, row: 12 } as const

/** 敌军生成间隔（秒）。*/
export const ENEMY_SPAWN_INTERVAL = 3

/** AI 决策间隔（秒），避免每帧重算 FSM。*/
export const AI_DECISION_INTERVAL = 0.5

// ─── 道具 ────────────────────────────────────────────────────────────────────

/** 每关最多出现的道具数量。*/
export const MAX_POWERUPS_ON_FIELD = 1

/** 道具停留时间（秒）；超时自动消失。*/
export const POWERUP_LIFETIME = 10

// ─── 输入默认键位（可被 settingsStore 覆盖） ─────────────────────────────────

export const DEFAULT_KEYMAP = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  fire: 'Space',
  pause: 'Escape',
} as const

export const ALT_KEYMAP = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  fire: 'Space',
  pause: 'Escape',
} as const

export const INPUT_GAME_KEYS: readonly string[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'Escape',
]

// ─── 存档 / 排行榜 ──────────────────────────────────────────────────────────

export const LEADERBOARD_STORAGE_KEY = 'tankwar_leaderboard'
export const SETTINGS_STORAGE_KEY = 'tankwar_settings'
export const LEADERBOARD_MAX_ENTRIES = 10

// ─── 结算 / 生命 / 得分（T-12） ─────────────────────────────────────────────

/**
 * 玩家初始生命数（红白机原版 = 3）。
 * 每关开局重置为该值？→ 否：跨关继承，只在整局重开时才重置为 3。
 * 见 [GameCanvas](../components/GameCanvas.tsx) 里的 sessionRef.lives。
 */
export const PLAYER_INITIAL_LIVES = 3

/**
 * 玩家坦克重生时的出生保护时长（秒）；与 SPAWN_INVULNERABLE 分开，
 * 因为红白机原版对玩家重生保护要比敌军出生保护略长（~2s）。
 */
export const PLAYER_RESPAWN_INVULNERABLE = 2

/**
 * 击杀不同类型敌军的得分表（红白机原版：100/200/300/400）。
 * key 与 [EnemyKind](../types.ts#L55-L55) 对齐，供 [SCORE_TABLE](#L211-L216) 直接消费。
 */
export const SCORE_TABLE: Readonly<Record<'basic' | 'fast' | 'power' | 'armor', number>> = {
  basic: 100,
  fast: 200,
  power: 300,
  armor: 400,
}

/**
 * 关卡终局判定：本关目标击杀数 = ENEMIES_PER_STAGE 全灭。
 * 与 [ENEMIES_PER_STAGE](#L119-L120) 保持一致，供 GameCanvas 判定 stage-clear。
 */
export const STAGE_CLEAR_TARGET = ENEMIES_PER_STAGE

/** 击破基地后，等待多少秒再触发 game-over 覆盖层（给爆炸动画留时间）。 */
export const GAME_OVER_DELAY = 1.5

/** 关卡通关后 stage-clear 结算页停留多少秒再自动进入下一关。 */
export const STAGE_CLEAR_DURATION = 4

/** 每个 kind 的分数动画每条累加间隔（秒），让统计逐条飘出。 */
export const STAGE_CLEAR_TICK = 0.4

// ─── 调色板（与 Tailwind theme 保持一致，供 Canvas 直接使用） ────────────────
// 修改这里的十六进制值时，请同步更新 tailwind.config.js 中的 colors.tank / terrain。

export const PALETTE = {
  stage: '#000000',
  tank: {
    player: '#e6e62e',
    player2: '#3ab34a',
    basic: '#d9d9d9',
    fast: '#f2b431',
    power: '#8a8a8a',
    armor: '#c65fbf',
  },
  terrain: {
    brick: '#b34a20',
    brickShadow: '#5c2610',
    steel: '#8a8a8a',
    steelShadow: '#3a3a3a',
    water: '#3c6bf0',
    waterHi: '#7fa8ff',
    grass: '#5fbb1e',
    ice: '#c3e8ff',
    base: '#e6e62e',
  },
  bullet: '#ffffff',
} as const
