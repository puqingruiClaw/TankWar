/**
 * 可种子的伪随机数生成器。
 *
 * 采用 mulberry32，32 位状态、简单、速度快，且对同一种子输出确定序列——
 * 便于关卡随机事件（掉落道具、敌军类型）复现，也让未来的自动测试有可预期性。
 *
 * @see https://en.wikipedia.org/wiki/Xorshift#Mulberry32
 */

export interface Rng {
  /** 下一次调用返回一个 [0, 1) 的浮点数（类比 Math.random）。*/
  next(): number
  /** 返回 [min, max) 范围内的整数。*/
  int(min: number, max: number): number
  /** 从数组中等概率取一个元素；数组非空由调用方保证。*/
  pick<T>(arr: readonly T[]): T
  /** 按概率 p ∈ [0,1] 返回布尔值。*/
  chance(p: number): boolean
}

/**
 * 用给定种子创建一个 RNG。
 * 传 `undefined` 时使用 `Date.now()`，即每次刷新都不同。
 */
export function createRng(seed?: number): Rng {
  let state = (seed ?? Date.now()) >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(min, max) {
      if (max <= min) return min
      return Math.floor(next() * (max - min)) + min
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)]
    },
    chance(p) {
      return next() < p
    },
  }
}
