/**
 * leaderboard 单元测试（T-23）
 *
 * 覆盖 [leaderboard.ts](file:///Users/puqingrui/workspace/Projects/TankWar/src/lib/leaderboard.ts) 的公共 API：
 * - sanitizeName：脏输入 → 3 字母大写补齐
 * - qualifies：未满榜/破榜/并列末位规则
 * - insert：稳定排序 + rank 计算 + 挤出榜
 * - save + load：localStorage 往返、Top-N 截断、JSON 脏数据容错
 * - clear：清空
 *
 * jsdom 环境自带 localStorage，且我们通过 beforeEach 清理，避免用例互相污染。
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { LEADERBOARD_MAX_ENTRIES, LEADERBOARD_STORAGE_KEY } from '@/game/constants'
import {
  clear,
  insert,
  load,
  qualifies,
  sanitizeName,
  save,
  type LeaderboardEntry,
} from '@/lib/leaderboard'

function mk(name: string, score: number, stage = 1, createdAt = 0): LeaderboardEntry {
  return { name, score, stage, createdAt }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('sanitizeName', () => {
  it('小写字母全部转大写', () => {
    expect(sanitizeName('abc')).toBe('ABC')
  })

  it('数字与符号被过滤，仅保留字母', () => {
    expect(sanitizeName('a1!b_c')).toBe('ABC')
  })

  it('不足 3 位右补 A', () => {
    expect(sanitizeName('x')).toBe('XAA')
    expect(sanitizeName('')).toBe('AAA')
  })

  it('超过 3 位截断', () => {
    expect(sanitizeName('ABCDEF')).toBe('ABC')
  })
})

describe('qualifies', () => {
  it('score <= 0 永不上榜', () => {
    expect(qualifies(0, [])).toBe(false)
    expect(qualifies(-100, [])).toBe(false)
  })

  it('榜未满：任何正分都能上', () => {
    const list = [mk('AAA', 500)]
    expect(qualifies(1, list)).toBe(true)
  })

  it('榜已满且严格 > 末位：破榜', () => {
    const list: LeaderboardEntry[] = []
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i++) list.push(mk('AAA', 1000 - i * 10))
    // 末位分数 = 1000 - 9*10 = 910；999 > 910 → 破榜
    expect(qualifies(999, list)).toBe(true)
  })

  it('榜已满且并列末位：不破榜（保护老玩家）', () => {
    const list: LeaderboardEntry[] = []
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i++) list.push(mk('AAA', 1000 - i * 10))
    // 末位分数 = 1000 - 9*10 = 910
    expect(qualifies(910, list)).toBe(false)
  })
})

describe('insert', () => {
  it('返回 1-based rank + 排序后的 list', () => {
    const base = [mk('AAA', 300, 3), mk('BBB', 200, 2), mk('CCC', 100, 1)]
    const entry = mk('NEW', 250, 2, 999)
    const { rank, list } = insert(entry, base)
    expect(rank).toBe(2)
    expect(list.map((e) => e.name)).toEqual(['AAA', 'NEW', 'BBB', 'CCC'])
  })

  it('分数相同：stage 高者优先', () => {
    const base = [mk('OLD', 500, 3, 1)]
    const entry = mk('NEW', 500, 5, 2)
    const { rank, list } = insert(entry, base)
    expect(rank).toBe(1)
    expect(list[0].name).toBe('NEW')
  })

  it('分数与关卡都相同：createdAt 更小者优先（先到先得）', () => {
    const base = [mk('OLD', 500, 3, 100)]
    const entry = mk('NEW', 500, 3, 200)
    const { rank, list } = insert(entry, base)
    expect(rank).toBe(2)
    expect(list.map((e) => e.name)).toEqual(['OLD', 'NEW'])
  })

  it('超 Top-N 被挤出榜：rank = -1', () => {
    const base: LeaderboardEntry[] = []
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i++) base.push(mk('AAA', 10000 - i, 5, i))
    const entry = mk('LOW', 1, 1, 999) // 分数最低
    const { rank, list } = insert(entry, base)
    expect(rank).toBe(-1)
    expect(list).toHaveLength(LEADERBOARD_MAX_ENTRIES)
    expect(list.some((e) => e.name === 'LOW')).toBe(false)
  })
})

describe('save + load 往返', () => {
  it('save 后 load 得到排序结果', () => {
    save([mk('AAA', 100, 1, 1), mk('BBB', 500, 3, 2), mk('CCC', 300, 2, 3)])
    const list = load()
    expect(list.map((e) => e.name)).toEqual(['BBB', 'CCC', 'AAA'])
  })

  it('save 会 slice 到 LEADERBOARD_MAX_ENTRIES', () => {
    const many: LeaderboardEntry[] = []
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES + 5; i++) many.push(mk('AAA', 1000 - i, 5, i))
    save(many)
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY)!
    const parsed = JSON.parse(raw) as unknown[]
    expect(parsed).toHaveLength(LEADERBOARD_MAX_ENTRIES)
  })

  it('load：无数据 → []', () => {
    expect(load()).toEqual([])
  })

  it('load：非法 JSON 不抛错，返回 []', () => {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, '{not json')
    expect(load()).toEqual([])
  })

  it('load：非数组结构 → []', () => {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(load()).toEqual([])
  })

  it('load：混入脏字段的条目也能被反序列化并补齐默认值', () => {
    const dirty = [
      { name: 'zyx', score: 200, stage: 2, createdAt: 1 },
      { name: 123, score: 'NaN', stage: null, createdAt: undefined }, // 全脏
      null, // 会被过滤
    ]
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(dirty))
    const list = load()
    expect(list).toHaveLength(2)
    // 'zyx' → 'ZYX'（3 位大写字母）；name=123 走默认值 'AAA'；score='NaN' → 0
    // 排序后：ZYX(200) 在前，AAA(0) 在后
    expect(list[0].name).toBe('ZYX')
    expect(list[0].score).toBe(200)
    expect(list[1].name).toBe('AAA')
    expect(list[1].score).toBe(0)
  })
})

describe('clear', () => {
  it('清空后 load 返回 []', () => {
    save([mk('AAA', 100)])
    expect(load()).toHaveLength(1)
    clear()
    expect(load()).toEqual([])
    expect(window.localStorage.getItem(LEADERBOARD_STORAGE_KEY)).toBeNull()
  })
})
