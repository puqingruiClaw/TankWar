/**
 * PowerUp 实体工厂 —— T-17 起随"闪烁敌军"被击杀而生成。
 *
 * 与 [Bullet](./Bullet.ts) 一样是纯数据实体，具体拾取判定 / 生命衰减 / 效果分发
 * 全部集中在 [PowerUpSystem](../systems/PowerUpSystem.ts)，本文件仅回答两个问题：
 *
 * 1. 「一个道具长什么样？」 → [createPowerUp](#L64-L82)
 * 2. 「应该放到哪一格？」   → [pickPowerUpSpawnCell](#L96-L138)
 *
 * 教学要点：
 * - **实体 = 数据**：createPowerUp 只返回 [PowerUp](../types.ts#L87-L91) 字面量，
 *   不带 `update()` 方法，符合 ECS 里"数据与行为分离"的取舍。
 * - **落地点合法性**：道具不能生成在墙 / 水 / 基地上，也应避开草丛（视觉遮挡）
 *   与出生点、并与基地保持 ≥1 格距离，避免"贴脸捡到 shovel 却已经被炮打脸"。
 * - **可复现随机**：位置 & kind 全部经由外部注入的 [Rng](../utils/rng.ts) 抽取，
 *   便于关卡重放 / 单测断言。
 */

import { allocEntityId } from './Tank'
import {
  BASE_POSITION,
  ENEMY_SPAWN_POINTS,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_SPAWN_POINTS,
  POWERUP_LIFETIME,
  TILE_SIZE,
} from '../constants'
import { gridToWorld, tileTypeAt } from '../utils/grid'
import type { LevelMap, PowerUp, PowerUpKind, Rect } from '../types'
import type { Rng } from '../utils/rng'

/**
 * 6 种 kind 的等概率抽取池；未来若想为"星"提高权重，可改为
 * ['star','star','helmet',...] 的重复元素池而无需引入 pickWeighted。
 */
const POWERUP_KINDS: readonly PowerUpKind[] = ['star', 'helmet', 'bomb', 'shovel', 'clock', 'tank']

/** 从 6 类道具池等概率抽一个 kind。 */
export function pickPowerUpKind(rng: Rng): PowerUpKind {
  return rng.pick(POWERUP_KINDS)
}

/**
 * 组装一个新道具。位置由 `col/row` 网格转成像素坐标，尺寸固定 = TILE_SIZE，
 * 与玩家 / 敌军 / 地形块视觉一致，方便判定"整格覆盖"。
 *
 * @param kind   道具类型
 * @param col    落地列
 * @param row    落地行
 * @returns      alive=true、lifetime=[POWERUP_LIFETIME](../constants.ts#L167) 的道具
 */
export function createPowerUp(kind: PowerUpKind, col: number, row: number): PowerUp {
  const { x, y } = gridToWorld(col, row)
  return {
    id: allocEntityId(),
    kind,
    dir: 'up',
    alive: true,
    x,
    y,
    w: TILE_SIZE,
    h: TILE_SIZE,
    lifetime: POWERUP_LIFETIME,
  }
}

/** 道具的整格 AABB —— [PowerUpSystem](../systems/PowerUpSystem.ts) 拾取用。 */
export function powerUpRect(p: PowerUp): Rect {
  return { x: p.x, y: p.y, w: p.w, h: p.h }
}

/**
 * 在地图上挑一格合法的道具落地点。
 *
 * 合法性判定（依次收严）：
 * - 必须是 `empty` / `grass` / `ice` 中之一：不能压在砖 / 钢 / 水 / 基地上；
 * - 不能落在敌军刷新点：会立刻被新刷出的坦克覆盖；
 * - 不能落在玩家出生点：容易"刚点出来就被自己顶到"；
 * - 与基地保持切比雪夫距离 ≥ 2 格：避免"贴脸出 shovel/bomb 却先死"；
 * - 不能与已有道具重合：MAX_POWERUPS_ON_FIELD=1 时理论上永远不重合，多个也稳；
 *
 * 若 128 次抽样后仍无解（极端拥挤地图）则 fallback 到线性扫描一次，
 * 再无解才返回 `null`。
 */
export function pickPowerUpSpawnCell(
  map: LevelMap,
  rng: Rng,
  existing: readonly PowerUp[],
): { col: number; row: number } | null {
  const occupied = new Set<string>()
  for (const p of existing) {
    if (!p.alive) continue
    const c = Math.floor((p.x + p.w / 2) / TILE_SIZE)
    const r = Math.floor((p.y + p.h / 2) / TILE_SIZE)
    occupied.add(`${c},${r}`)
  }

  function isValid(col: number, row: number): boolean {
    const t = tileTypeAt(map, col, row)
    if (t !== 'empty' && t !== 'grass' && t !== 'ice') return false
    if (occupied.has(`${col},${row}`)) return false
    for (const s of ENEMY_SPAWN_POINTS) {
      if (s.col === col && s.row === row) return false
    }
    for (const s of PLAYER_SPAWN_POINTS) {
      if (s.col === col && s.row === row) return false
    }
    const cheby = Math.max(Math.abs(col - BASE_POSITION.col), Math.abs(row - BASE_POSITION.row))
    if (cheby < 2) return false
    return true
  }

  for (let i = 0; i < 128; i++) {
    const col = rng.int(0, MAP_COLS)
    const row = rng.int(0, MAP_ROWS)
    if (isValid(col, row)) return { col, row }
  }

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (isValid(c, r)) return { col: c, row: r }
    }
  }
  return null
}
