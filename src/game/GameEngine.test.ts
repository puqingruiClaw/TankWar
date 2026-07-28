/**
 * GameEngine 单元测试（T-24 性能烟测）
 *
 * 目的：验证 [GameEngine](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/GameEngine.ts) 的三条"性能护栏"—— 不为覆盖 UI 效果，而是防止
 * 掉帧/切 tab 场景下引擎进入 spiral of death 或漏推逻辑。
 *
 * 手法：
 * - stub `requestAnimationFrame` 让 tick 变成"我们主动调"，不依赖真实时钟；
 * - stub `performance.now()` 让 dt 完全可控；
 * - 用 vi.fn 记录 update / render 调用次数并断言。
 *
 * 与 T-24 的 [docs/COMPAT-PERF-REPORT.md](file:///Users/puqingrui/workspace/Projects/TankWar/docs/COMPAT-PERF-REPORT.md)
 * 手测矩阵互补：手测覆盖真实浏览器 60 FPS 表现，单测覆盖引擎调度的边界不变式。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameEngine } from '@/game/GameEngine'
import { FIXED_DT, MAX_STEPS_PER_FRAME } from '@/game/constants'

/**
 * 一套"可控 RAF"：调用 rafStep(nowMs) 会推进 performance.now() 并触发上一次挂载的 tick。
 * 这样可以精确控制"两帧之间过了多少毫秒"。
 */
function installControlledRaf() {
  let nowMs = 0
  let pending: ((n: number) => void) | null = null

  const rafSpy = vi.fn((cb: (n: number) => void) => {
    pending = cb
    return 1
  })
  const cancelSpy = vi.fn(() => {
    pending = null
  })
  const nowSpy = vi.fn(() => nowMs)

  vi.stubGlobal('requestAnimationFrame', rafSpy)
  vi.stubGlobal('cancelAnimationFrame', cancelSpy)
  vi.stubGlobal(
    'performance',
    Object.assign(Object.create(performance), {
      now: nowSpy,
    }),
  )

  return {
    /** 推进到 targetMs 并执行当前挂起的 tick 回调。*/
    step(targetMs: number) {
      nowMs = targetMs
      const cb = pending
      pending = null
      if (cb) cb(nowMs)
    },
    get pending() {
      return pending
    },
  }
}

/** 创建一个已挂到 canvas 的引擎，返回引擎 + 关键 spy。*/
function makeEngine() {
  const canvas = document.createElement('canvas')
  canvas.width = 416
  canvas.height = 416
  // jsdom 默认不实现 <canvas> 2D 上下文；提供一个最小 stub 让 engine.mount 通过
  const ctxStub = { imageSmoothingEnabled: false } as unknown as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctxStub as unknown as RenderingContext,
  )
  const engine = new GameEngine()
  engine.mount(canvas)
  const update = vi.fn()
  const render = vi.fn()
  engine.setUpdate(update)
  engine.setRender(render)
  return { engine, update, render, canvas }
}

let raf: ReturnType<typeof installControlledRaf>

beforeEach(() => {
  raf = installControlledRaf()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GameEngine：固定步长归一化', () => {
  it('单帧 16.67ms → 恰好推进 1 步 update', () => {
    const { engine, update, render } = makeEngine()
    engine.start() // start 内部会读一次 performance.now() 作为 lastTime（=0），并请求首帧
    // 首次 tick 在 t=16.67ms：deltaSeconds = 0.01667s，acc = 1/60s，恰好触发 1 步
    raf.step(1000 / 60)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenLastCalledWith(FIXED_DT)
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('单帧 33.33ms（30 FPS 掉帧场景）→ 追 2 步 update，逻辑不掉速', () => {
    const { engine, update } = makeEngine()
    engine.start()
    raf.step(1000 / 30) // 一次 RAF 累积了 2 帧的时间
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('单帧 100ms（长阻塞）→ 追帧数被 MAX_STEPS_PER_FRAME 限制', () => {
    const { engine, update } = makeEngine()
    engine.start()
    raf.step(100) // 100ms 内理论应推 6 步，但 MAX_STEPS_PER_FRAME=5
    expect(update).toHaveBeenCalledTimes(MAX_STEPS_PER_FRAME)
  })
})

describe('GameEngine：切 tab / 长阻塞防 spiral', () => {
  it('单帧 5s（切 tab 回来）被夹到 250ms 上限，防止死循环追帧', () => {
    const { engine, update } = makeEngine()
    engine.start()
    // 5 秒 = 300 步的时间，但会被 MAX_FRAME_DELTA(0.25s) 夹住
    // 又被 MAX_STEPS_PER_FRAME(5) 限住 → 最多 5 步
    raf.step(5000)
    expect(update).toHaveBeenCalledTimes(MAX_STEPS_PER_FRAME)
  })

  it('长阻塞后剩余 acc 被丢弃（不会在下一帧继续追帧）', () => {
    const { engine, update } = makeEngine()
    engine.start()
    // 用"6 帧的 delta"来触发追帧上限：理论 6 步、被 MAX_STEPS_PER_FRAME(5) 截断，
    // 剩余 acc ≈ FIXED_DT（因 IEEE 754 残差略大于阈值 → 命中 `if (acc > FIXED_DT) acc = 0`）
    const sixFramesMs = (1000 / 60) * 6
    raf.step(sixFramesMs)
    update.mockClear()
    // 紧接一帧（间隔 16.67ms）：若未丢弃，会触发 2 步（旧残余 + 新增）；
    // 已丢弃则只推 1 步 —— 断言语义 = "长阻塞不会把积压带到下一帧"
    raf.step(sixFramesMs + 1000 / 60)
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('GameEngine：pause / resume', () => {
  it('pause 期间 update 不执行，render 仍执行', () => {
    const { engine, update, render } = makeEngine()
    engine.start()
    raf.step(1000 / 60) // 正常 1 步
    expect(update).toHaveBeenCalledTimes(1)

    engine.pause()
    update.mockClear()
    render.mockClear()
    raf.step(1000 / 60 + 1000 / 60)
    raf.step(1000 / 60 + (2 * 1000) / 60)
    expect(update).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(2) // 每次 RAF 仍渲染（用于显示暂停画面）
  })

  it('resume 后重置时间基线，不会因暂停累积而暴推逻辑', () => {
    const { engine, update } = makeEngine()
    engine.start()
    engine.pause()
    raf.step(1000) // 暂停 1s
    raf.step(2000) // 再暂停 1s
    expect(update).not.toHaveBeenCalled()

    engine.resume()
    raf.step(2000 + 1000 / 60) // 恢复后过 1 帧
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('GameEngine：stats 广播', () => {
  it('累积 >=1s 后 publish 一次 fps/ups 快照', () => {
    const { engine } = makeEngine()
    const listener = vi.fn()
    engine.subscribeStats(listener)
    // 订阅时立即回调一次初始值
    listener.mockClear()

    engine.start()
    // 模拟 61 帧、每帧 16.67ms → 累计略超 1s（避开 60/60 = 0.999... 的浮点误差）
    const frameMs = 1000 / 60
    for (let i = 1; i <= 61; i++) raf.step(i * frameMs)

    expect(listener).toHaveBeenCalled()
    const last = listener.mock.calls.at(-1)![0]
    // 60 FPS 目标：允许 ±2 的舍入误差
    expect(last.fps).toBeGreaterThanOrEqual(58)
    expect(last.fps).toBeLessThanOrEqual(62)
    expect(last.ups).toBeGreaterThanOrEqual(58)
    expect(last.ups).toBeLessThanOrEqual(62)
    expect(last.frameMs).toBeGreaterThan(0)
  })
})

describe('GameEngine：生命周期', () => {
  it('stop 后 tick 不再被调度', () => {
    const { engine, update } = makeEngine()
    engine.start()
    raf.step(1000 / 60)
    engine.stop()
    update.mockClear()
    // 此时 pending 已被取消；即使我们再 step 也不会再触发 update
    raf.step(1000 / 60 + 1000 / 60)
    expect(update).not.toHaveBeenCalled()
  })

  it('未 mount 直接 start 会抛错，保护开发期误用', () => {
    const engine = new GameEngine()
    expect(() => engine.start()).toThrow(/Call mount/)
  })
})
