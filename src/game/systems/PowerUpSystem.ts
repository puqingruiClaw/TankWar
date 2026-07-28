/**
 * PowerUpSystem —— 道具场上的生命衰减、拾取、效果分发（T-17）。
 *
 * 职责矩阵：
 *
 *   函数                         | 输入          | 副作用
 *   ─────────────────────────────┼──────────────┼──────────────────────────────
 *   [stepPowerUps](#L47-L67)      | powerUps, dt  | 就地衰减 lifetime；expire → alive=false
 *   [detectPickup](#L74-L92)      | powerUps, tank| 找到与 tank 相交的道具（不改状态）
 *   [applyPowerUpEffect](#L112)   | ctx, kind     | 分发 6 类效果（改坦克/地图/session）
 *   [tickShovelTimer](#L188-L213) | ctx, dt       | shovel 到期还原砖
 *
 * 与 [CollisionSystem](./CollisionSystem.ts) 一样，本文件只操作纯数据；上层
 * [GameCanvas](../../components/GameCanvas.tsx) 负责组装 ctx / 消费事件。
 *
 * 教学要点：
 * - **"效果 = 状态突变"**：6 种道具最终都对应到 tank/session/map 上的一个字段变化，
 *   不引入独立的 "buff 对象"，减少同步成本、也让存档 / 回放天然可序列化。
 * - **拾取 ≠ 生命衰减**：把两个循环拆开，方便未来加"敌军也能踩到 bomb 触发"这类
 *   变体规则时不改动衰减逻辑。
 * - **shovel 备份**：把原始 tile code 存进 `shovelBackup` Map<key, code>，
 *   到期时按 key 精确还原；即使玩家先破坏了钢墙，也不会误还原砖回去（key 不存在）。
 */

import {
  BASE_POSITION,
  MAP_COLS,
  MAP_ROWS,
  POWERUP_CLOCK_DURATION,
  POWERUP_HELMET_DURATION,
  POWERUP_PICKUP_SCORE,
  POWERUP_SHOVEL_DURATION,
  POWERUP_STAR_MAX_LEVEL,
  POWERUP_TANK_LIFE_GAIN,
  TILE_CODE,
} from '../constants'
import { inGridBounds, makeRect, rectsIntersect } from '../utils/grid'
import type { LevelMap, PlayerLevel, PowerUp, PowerUpKind, Tank, TileCode } from '../types'

// ─── 生命衰减 & 拾取 ────────────────────────────────────────────────────────

/**
 * 每帧衰减所有道具的 lifetime，超时自动 alive=false。
 * 就地修改 powerUps；返回本帧过期的道具列表（供上层触发消失特效 / 计数）。
 */
export function stepPowerUps(powerUps: PowerUp[], dt: number): PowerUp[] {
  const expired: PowerUp[] = []
  for (const p of powerUps) {
    if (!p.alive) continue
    p.lifetime -= dt
    if (p.lifetime <= 0) {
      p.lifetime = 0
      p.alive = false
      expired.push(p)
    }
  }
  return expired
}

/** 移除所有 alive=false 的道具，防止数组无限增长。 */
export function prunePowerUps(powerUps: PowerUp[]): void {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    if (!powerUps[i].alive) powerUps.splice(i, 1)
  }
}

/**
 * 找到第一个与 tank 相交且 alive 的道具。找到即返回，不批量拾取——
 * 场上永远只可能有 1 个道具时该实现就是正解；未来若放宽 MAX 也能自然扩展
 * （调用方在 while 循环里连续调用即可）。
 */
export function detectPickup(powerUps: readonly PowerUp[], tank: Tank): PowerUp | null {
  if (!tank.alive) return null
  const trect = makeRect(tank.x, tank.y, tank.w, tank.h)
  for (const p of powerUps) {
    if (!p.alive) continue
    if (rectsIntersect(trect, makeRect(p.x, p.y, p.w, p.h))) return p
  }
  return null
}

// ─── 效果分发 ────────────────────────────────────────────────────────────────

/**
 * 应用某个道具的效果所需的上下文。集中在一个 struct 里而不是散在参数列表：
 * 未来加"多人道具（如 mine）"时改这里，调用点无需重排参数顺序。
 */
export interface PowerUpEffectContext {
  /** 拾取者（玩家）。 */
  player: Tank
  /** 场上所有敌军坦克（含冷冻中的、已死的；本函数按需过滤）。 */
  enemies: Tank[]
  /** 关卡地图；shovel 会就地改写。 */
  map: LevelMap
  /** 触发时的 sessionRef 引用（新增 buff 字段全部写在这里）。 */
  session: PowerUpSessionState
}

/**
 * 上层 sessionRef 需要暴露给道具系统的最小字段集。GameCanvas 只需让 sessionRef
 * "满足这个 interface" 即可，不用整段替换类型定义。
 */
export interface PowerUpSessionState {
  /** 玩家累计分数（tank 道具 & 拾取加分都会累加到这里）。 */
  score: number
  /** 玩家剩余命数（tank 道具 +1）。 */
  lives: number
  /** clock 剩余冻结时间；>0 时 AI + Movement 都跳过敌军。 */
  freezeTimer: number
  /** shovel 剩余持续时间；>0 时表示基地周围被钢化。 */
  shovelTimer: number
  /**
   * shovel 生效期间的原始 tile 备份。
   * key = `${col},${row}`；到期按 key 精确还原。
   */
  shovelBackup: Map<string, TileCode>
  /** 累计拾取的道具数（HUD / 关卡结算展示）。 */
  powerUpsCollected: number
}

export interface PowerUpEffectResult {
  /** 触发该道具的 kind。 */
  kind: PowerUpKind
  /** 触发时加给玩家的分数（含 [POWERUP_PICKUP_SCORE](../constants.ts#L188-L189)）。 */
  scoreDelta: number
  /**
   * bomb 效果下被瞬间清屏的敌军列表；供上层生成爆炸特效 & 计数（本项目
   * bomb 按红白机原版规则不计分）。
   */
  bombVictims: Tank[]
}

/**
 * 把 6 类效果集中在一个 switch 里，避免调用点各处 if-else。
 *
 * 返回值供上层：
 * - 累加分数（session.score）——放在这里而不是内部直接改，是为了保留"审计入口"，
 *   方便未来接入 stats 面板 / 成就系统；
 * - 触发爆炸特效（bombVictims）——上层可以在同一帧调用 events.onExplosion。
 */
export function applyPowerUpEffect(
  kind: PowerUpKind,
  ctx: PowerUpEffectContext,
): PowerUpEffectResult {
  const result: PowerUpEffectResult = {
    kind,
    scoreDelta: POWERUP_PICKUP_SCORE,
    bombVictims: [],
  }
  const { player, enemies, map, session } = ctx

  switch (kind) {
    case 'star': {
      const nextLevel = Math.min(player.level + 1, POWERUP_STAR_MAX_LEVEL) as PlayerLevel
      player.level = nextLevel
      break
    }
    case 'helmet': {
      player.invulnerable = Math.max(player.invulnerable, POWERUP_HELMET_DURATION)
      break
    }
    case 'bomb': {
      for (const e of enemies) {
        if (!e.alive) continue
        e.hp = 0
        e.alive = false
        result.bombVictims.push(e)
      }
      break
    }
    case 'shovel': {
      applyShovel(map, session)
      break
    }
    case 'clock': {
      session.freezeTimer = Math.max(session.freezeTimer, POWERUP_CLOCK_DURATION)
      break
    }
    case 'tank': {
      session.lives += POWERUP_TANK_LIFE_GAIN
      break
    }
  }

  session.powerUpsCollected += 1
  return result
}

// ─── shovel 专用工具 ────────────────────────────────────────────────────────

/**
 * 基地周围 8 格的相对偏移（不含基地本格）。用于 shovel 效果 & 到期还原时统一取址。
 * 相对 [BASE_POSITION](../constants.ts#L145)：
 * ```
 * .###.
 * .#B#.   B=基地本身；# = shovel 覆盖的 8 格
 * .....
 * ```
 * 底部一行 (dy=1) 全部越界（基地已在最底行），运行时按 inGridBounds 过滤。
 */
const SHOVEL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/** 把基地周围 8 格改成钢墙；原始 tile 备份进 session.shovelBackup。 */
function applyShovel(map: LevelMap, session: PowerUpSessionState): void {
  session.shovelBackup.clear()
  for (const [dx, dy] of SHOVEL_OFFSETS) {
    const col = BASE_POSITION.col + dx
    const row = BASE_POSITION.row + dy
    if (!inGridBounds(col, row)) continue
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) continue
    session.shovelBackup.set(`${col},${row}`, map[row][col])
    map[row][col] = TILE_CODE.STEEL
  }
  session.shovelTimer = POWERUP_SHOVEL_DURATION
}

/**
 * 每帧衰减 shovelTimer；到期把备份的原始 tile 还原（若期间玩家没击碎钢墙的话
 * 就是"还原砖块"；若备份里没有 key 则说明地格已被别的效果占用，跳过）。
 *
 * 返回 true 表示"本帧刚过期，做了一次还原"，上层可用来播 SFX / 抖屏。
 */
export function tickShovelTimer(map: LevelMap, session: PowerUpSessionState, dt: number): boolean {
  if (session.shovelTimer <= 0) return false
  session.shovelTimer -= dt
  if (session.shovelTimer > 0) return false

  session.shovelTimer = 0
  for (const [key, originalCode] of session.shovelBackup) {
    const [colStr, rowStr] = key.split(',')
    const col = Number(colStr)
    const row = Number(rowStr)
    if (!inGridBounds(col, row)) continue
    // 只有当前格仍是钢墙（未被玩家 lv3 打穿）时才还原，避免把 EMPTY 覆盖成砖。
    if (map[row][col] === TILE_CODE.STEEL) {
      map[row][col] = originalCode
    }
  }
  session.shovelBackup.clear()
  return true
}

/** 每帧衰减 clock 冻结计时器。 */
export function tickFreezeTimer(session: PowerUpSessionState, dt: number): void {
  if (session.freezeTimer <= 0) return
  session.freezeTimer = Math.max(0, session.freezeTimer - dt)
}
