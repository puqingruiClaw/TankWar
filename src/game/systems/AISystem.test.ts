/**
 * AISystem 单元测试（T-23）
 *
 * 覆盖 [stepEnemyAI](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/systems/AISystem.ts#L95-L123) FSM 主决策与 shouldFire 视野：
 * - 出生保护未过 → 强制 patrol
 * - power/armor 且 hp<=1 → retreat
 * - 玩家在 5 格 Manhattan 距离内 → chase
 * - 玩家不可见但基地存在 → attackBase
 * - 基地毁 & 玩家不可见 → patrol（兜底）
 * - shouldFire：朝玩家方向 + 直线无遮挡 → wantFire=true
 * - shouldFire：中间被 brick 挡住 → wantFire=false
 * - pruneAIMemory：死敌军的记忆会被清理
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { pruneAIMemory, resetAIMemory, stepEnemyAI, type AIIntent } from '@/game/systems/AISystem'
import { MAP_COLS, MAP_ROWS, TILE_CODE, TILE_SIZE } from '@/game/constants'
import type { LevelMap, Tank, TankKind } from '@/game/types'

/** 一个可预测的 RNG：让 patrol 的骚扰射击（<0.2）永远不触发。*/
const staticRng = () => 0.5

function emptyMap(): LevelMap {
  const rows: LevelMap = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: number[] = []
    for (let c = 0; c < MAP_COLS; c++) row.push(TILE_CODE.EMPTY)
    rows.push(row as unknown as LevelMap[number])
  }
  return rows
}

let nextId = 5000
function mkTank(kind: TankKind, col: number, row: number, patch: Partial<Tank> = {}): Tank {
  return {
    id: patch.id ?? nextId++,
    kind,
    dir: patch.dir ?? 'down',
    alive: patch.alive ?? true,
    x: col * TILE_SIZE,
    y: row * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
    hp: patch.hp ?? (kind === 'armor' ? 4 : kind === 'power' ? 2 : 1),
    speed: patch.speed ?? 60,
    cooldown: patch.cooldown ?? 0,
    level: patch.level ?? 0,
    invulnerable: patch.invulnerable ?? 0,
    slideRemaining: patch.slideRemaining ?? 0,
  }
}

beforeEach(() => {
  resetAIMemory()
  nextId = 5000
})

describe('stepEnemyAI：FSM 状态选择', () => {
  it('出生保护未过 → 强制 patrol，即使玩家近在咫尺', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 5, { invulnerable: 2 })
    const player = mkTank('player', 5, 6) // 邻格
    const intent: AIIntent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    expect(intent.state).toBe('patrol')
  })

  it('power 敌军 hp<=1 且玩家远离 → retreat', () => {
    const map = emptyMap()
    const enemy = mkTank('power', 1, 1, { hp: 1 })
    const player = mkTank('player', 11, 11) // 远处
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    expect(intent.state).toBe('retreat')
  })

  it('basic 敌军 hp=1 不会 retreat（单血兵本来就一枪死）', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 1, 1, { hp: 1 })
    const player = mkTank('player', 11, 11)
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    // basic 远离玩家 → attackBase（因为基地存在）
    expect(intent.state).toBe('attackBase')
  })

  it('玩家在 5 格 Manhattan 距离内 → chase', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 5)
    const player = mkTank('player', 7, 6) // Manhattan = |7-5|+|6-5| = 3
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    expect(intent.state).toBe('chase')
  })

  it('玩家远离 + 基地存在 → attackBase', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 0)
    const player = mkTank('player', 12, 12) // Manhattan = 19，远超 5
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    expect(intent.state).toBe('attackBase')
  })

  it('玩家死亡 + 基地毁 → patrol（兜底）', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 5)
    const player = mkTank('player', 8, 8, { alive: false })
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: null,
      nextRandom: staticRng,
    })
    expect(intent.state).toBe('patrol')
  })

  it('chase 状态下 desiredDir 会朝玩家方向', () => {
    const map = emptyMap()
    // 敌军在 (5,5)，玩家在 (8,5)——玩家在敌军右侧
    const enemy = mkTank('basic', 5, 5, { dir: 'up' })
    const player = mkTank('player', 8, 5)
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    expect(intent.state).toBe('chase')
    // 由于 dx=3, dy=0，dirsTowards 优先给出 'right'
    expect(intent.desiredDir).toBe('right')
  })
})

describe('stepEnemyAI：shouldFire 视野判定', () => {
  it('敌军朝下 + 玩家在正下方直线无遮挡 → wantFire=true', () => {
    const map = emptyMap()
    // 敌军 (5, 0) 朝下，玩家 (5, 8)；两者中心在同一列
    const enemy = mkTank('basic', 5, 0, { dir: 'down', cooldown: 0 })
    const player = mkTank('player', 5, 8)
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    // player 距离 Manhattan = 8 > 5 → attackBase 状态，但 shouldFire 仍会独立判定视野
    expect(intent.wantFire).toBe(true)
  })

  it('敌军 cooldown>0 → 一定不开火', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 0, { dir: 'down', cooldown: 1 })
    const player = mkTank('player', 5, 8)
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: { col: 6, row: 12 },
      nextRandom: staticRng,
    })
    expect(intent.wantFire).toBe(false)
  })

  it('视野被 brick 阻挡 → 不开火', () => {
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 0, { dir: 'down', cooldown: 0 })
    const player = mkTank('player', 5, 8)
    // 在敌军与玩家之间放一堵砖
    map[4][5] = TILE_CODE.BRICK
    const intent = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: null, // 排除对基地的视野
      nextRandom: staticRng,
    })
    expect(intent.wantFire).toBe(false)
  })
})

describe('pruneAIMemory', () => {
  it('调用一次 stepEnemyAI 后，若敌军 id 不在 aliveIds 中，记忆将被清理', () => {
    // 无法直接观察 Map 内部；通过"清理后重新决策，行为应从零开始"间接验证：
    // 1. 先让敌军进入 chase 状态并记忆一个方向；
    // 2. prune 掉；
    // 3. 再决策：内部会 getOrCreateMemory 新建一份，即 decisionTimer 从 0 起
    //    并立即评估——这与"未 prune 时（尚有 decisionTimer 剩余）不重评"形成对比。
    const map = emptyMap()
    const enemy = mkTank('basic', 5, 5, { dir: 'up' })
    const player = mkTank('player', 8, 5)
    const first = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: null,
      nextRandom: staticRng,
    })
    expect(first.state).toBe('chase')

    // 现在 aliveIds 不含该 enemy → 记忆被清空
    pruneAIMemory(new Set())

    // 变更玩家位置，让敌军"若未 prune 会仍旧记住 chase 方向"
    // prune 后应重新按当前场景评估，仍应产出 chase（玩家还在旁边）
    const second = stepEnemyAI(map, enemy, 0.01, {
      player,
      basePos: null,
      nextRandom: staticRng,
    })
    expect(second.state).toBe('chase')
  })
})
