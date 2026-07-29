/**
 * 关卡 registry 与 validateLevel 单元测试
 *
 * 保护契约：
 *  - LEVELS 数组完整、id 递增且唯一、TOTAL_STAGES 派生正确
 *  - 每张地图都能通过 [validateLevel](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/maps/levels.ts#L88-L160)
 *    的 5 项契约（尺寸 / tile 合法 / 基地唯一 / spawn 空 / queue 长度）
 *  - getLevelById / getLevelByIndex 的边界行为
 *  - STAGE_HINTS 每关都有条目且长度受控（HUD 显示不溢出）
 *  - 反面测试：注入违规地图 validateLevel 必抛，防止未来"条件反了"的静默 bug
 *  - 难度曲线锚点：终关 armor+power 比例 ≥ 首关，防"越改越简单"
 *
 * 之所以为关卡建这份守护网：v1.1 起关卡从 5 张扩到 10 张，未来还会更多；
 * 手写 map 极易在数字里改错一格，而 validateLevel 是 module top-level throw，
 * 冷启动才暴露、CI 拿不到明确的失败信号。这套测试把校验迁到 CI 门禁。
 */

import { describe, expect, it } from 'vitest'
import {
  BASE_POSITION,
  ENEMIES_PER_STAGE,
  ENEMY_SPAWN_POINTS,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_SPAWN_POINTS,
  TILE_CODE,
} from '@/game/constants'
import {
  DEFAULT_LEVEL,
  getLevelById,
  getLevelByIndex,
  LEVELS,
  STAGE_HINTS,
  TOTAL_STAGES,
  validateLevel,
} from '@/game/maps/levels'
import type { EnemyKind, LevelDefinition, LevelMap, TileCode } from '@/game/types'

/**
 * 深拷贝一张合法地图，用作反面测试的"起点"——
 * 从合法基线出发再单点破坏，保证只有目标断言被触发。
 */
function cloneMap(map: LevelMap): LevelMap {
  return map.map((row) => [...row])
}

function makeMutated(base: LevelDefinition, patch: (m: LevelMap) => void): LevelDefinition {
  const m = cloneMap(base.map)
  patch(m)
  return { ...base, map: m }
}

const VALID_ENEMY_KINDS: readonly EnemyKind[] = ['basic', 'fast', 'power', 'armor']
const HEAVY_KINDS: readonly EnemyKind[] = ['armor', 'power']

function heavyRatio(level: LevelDefinition): number {
  const heavy = level.enemyQueue.filter((k) => HEAVY_KINDS.includes(k)).length
  return heavy / level.enemyQueue.length
}

describe('LEVELS registry', () => {
  it('exposes exactly TOTAL_STAGES levels with monotonically increasing ids starting at 1', () => {
    expect(LEVELS.length).toBe(TOTAL_STAGES)
    expect(TOTAL_STAGES).toBeGreaterThanOrEqual(5)
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].id).toBe(i + 1)
    }
    const ids = LEVELS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('DEFAULT_LEVEL is the first level in LEVELS (冷启动 fallback 保持稳定)', () => {
    expect(DEFAULT_LEVEL).toBe(LEVELS[0])
  })
})

describe('validateLevel · 存量地图', () => {
  it.each(LEVELS.map((lv) => [lv.id, lv.name, lv]))(
    'STAGE %s (%s) passes all 5 契约',
    (_id, _name, lv) => {
      expect(() => validateLevel(lv)).not.toThrow()
    },
  )

  it('每张地图的 map 尺寸严格等于 MAP_ROWS × MAP_COLS', () => {
    for (const lv of LEVELS) {
      expect(lv.map.length).toBe(MAP_ROWS)
      for (const row of lv.map) expect(row.length).toBe(MAP_COLS)
    }
  })

  it('每张地图 (BASE_POSITION) 处必为 BASE，全图无 BASE_DEAD', () => {
    for (const lv of LEVELS) {
      expect(lv.map[BASE_POSITION.row][BASE_POSITION.col]).toBe(TILE_CODE.BASE)
      const baseDead = lv.map.flat().filter((c) => c === TILE_CODE.BASE_DEAD)
      expect(baseDead).toHaveLength(0)
    }
  })

  it('每张地图的 spawn 点均为 EMPTY', () => {
    for (const lv of LEVELS) {
      for (const p of ENEMY_SPAWN_POINTS) {
        expect(lv.map[p.row][p.col]).toBe(TILE_CODE.EMPTY)
      }
      for (const p of PLAYER_SPAWN_POINTS) {
        expect(lv.map[p.row][p.col]).toBe(TILE_CODE.EMPTY)
      }
    }
  })

  it('每张地图的 enemyQueue 长度 = ENEMIES_PER_STAGE 且元素均为合法 EnemyKind', () => {
    for (const lv of LEVELS) {
      expect(lv.enemyQueue).toHaveLength(ENEMIES_PER_STAGE)
      for (const k of lv.enemyQueue) {
        expect(VALID_ENEMY_KINDS).toContain(k)
      }
    }
  })
})

describe('validateLevel · 反面测试（防"条件反了"的静默 bug）', () => {
  const base = LEVELS[0]

  it('map 行数错误时必抛', () => {
    const bad: LevelDefinition = { ...base, map: base.map.slice(0, MAP_ROWS - 1) }
    expect(() => validateLevel(bad)).toThrow(/rows/)
  })

  it('map 某一行列数错误时必抛', () => {
    const bad = makeMutated(base, (m) => {
      m[0] = m[0].slice(0, MAP_COLS - 1)
    })
    expect(() => validateLevel(bad)).toThrow(/length/)
  })

  it('出现非法 tile code 时必抛', () => {
    const bad = makeMutated(base, (m) => {
      m[0][0] = 42 as unknown as TileCode
    })
    // spawn 校验早于 tile 校验中的部分路径都会触发 —— 只要抛就算过
    expect(() => validateLevel(bad)).toThrow()
  })

  it('基地不在 (BASE_POSITION) 时必抛', () => {
    const bad = makeMutated(base, (m) => {
      m[BASE_POSITION.row][BASE_POSITION.col] = TILE_CODE.EMPTY
    })
    expect(() => validateLevel(bad)).toThrow(/BASE/)
  })

  it('存在 2 个 BASE 时必抛', () => {
    const bad = makeMutated(base, (m) => {
      // 找一个原本是 EMPTY 且不是 spawn 点的格子，塞第二个 BASE
      // (1,1) 位置在所有 stage 里对 spawn 无冲突（尽管可能覆盖砖块，不影响这条断言）
      m[1][1] = TILE_CODE.BASE
    })
    expect(() => validateLevel(bad)).toThrow(/BASE/)
  })

  it('spawn 点被非空 tile 占据时必抛', () => {
    const bad = makeMutated(base, (m) => {
      m[ENEMY_SPAWN_POINTS[0].row][ENEMY_SPAWN_POINTS[0].col] = TILE_CODE.BRICK
    })
    expect(() => validateLevel(bad)).toThrow(/spawn/)
  })

  it('enemyQueue 长度不匹配时必抛', () => {
    const bad: LevelDefinition = {
      ...base,
      enemyQueue: base.enemyQueue.slice(0, ENEMIES_PER_STAGE - 1),
    }
    expect(() => validateLevel(bad)).toThrow(/enemyQueue length/)
  })

  it('enemyQueue 含非法 EnemyKind 时必抛', () => {
    const bad: LevelDefinition = {
      ...base,
      enemyQueue: [...base.enemyQueue.slice(0, -1), 'ghost' as unknown as EnemyKind],
    }
    expect(() => validateLevel(bad)).toThrow(/EnemyKind/)
  })
})

describe('lookup helpers', () => {
  it('getLevelById 命中现有 id、未命中返回 undefined', () => {
    for (const lv of LEVELS) {
      expect(getLevelById(lv.id)).toBe(lv)
    }
    expect(getLevelById(0)).toBeUndefined()
    expect(getLevelById(TOTAL_STAGES + 1)).toBeUndefined()
    expect(getLevelById(-1)).toBeUndefined()
  })

  it('getLevelByIndex 命中现有 index、越界返回 undefined', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(getLevelByIndex(i)).toBe(LEVELS[i])
    }
    expect(getLevelByIndex(-1)).toBeUndefined()
    expect(getLevelByIndex(LEVELS.length)).toBeUndefined()
  })
})

describe('STAGE_HINTS', () => {
  it('每关 id 都能在 STAGE_HINTS 里查到（可为 undefined，但 key 必须存在）', () => {
    for (const lv of LEVELS) {
      expect(Object.prototype.hasOwnProperty.call(STAGE_HINTS, lv.id)).toBe(true)
    }
  })

  it('已定义的 hint 长度 ≤ 40 字符，避免 HUD 溢出', () => {
    for (const lv of LEVELS) {
      const hint = STAGE_HINTS[lv.id]
      if (typeof hint === 'string') {
        expect(hint.length).toBeLessThanOrEqual(40)
      }
    }
  })
})

describe('难度曲线锚点', () => {
  it('终关的 armor+power 比例 ≥ 首关（防"越改越简单"）', () => {
    const first = LEVELS[0]
    const last = LEVELS[LEVELS.length - 1]
    expect(heavyRatio(last)).toBeGreaterThanOrEqual(heavyRatio(first))
  })

  it('首关 heavy 比例应低（≤ 20%），保护新手引导体验', () => {
    expect(heavyRatio(LEVELS[0])).toBeLessThanOrEqual(0.2)
  })
})
