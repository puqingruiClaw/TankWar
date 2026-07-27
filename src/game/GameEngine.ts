/**
 * GameEngine —— 主循环骨架（T-05）。
 *
 * 设计目标：
 * 1. **固定逻辑步长（fixed timestep）**：无论掉帧到 30/45 FPS，逻辑始终以
 *    {@link FIXED_DT} 步长推进，AI / 物理 / 碰撞永远看到确定 dt，防止穿墙。
 * 2. **RAF 驱动，可插拔渲染**：`requestAnimationFrame` 只负责 tick，实际逻辑
 *    /渲染通过 `setUpdate` / `setRender` 注入，未来 T-06~T-13 的各 System 通过
 *    组合方式接入。
 * 3. **可测量的性能**：内部统计 FPS 与平均 dt，每秒通过 `subscribeStats`
 *    通知外部（React HUD 消费）。
 * 4. **可 pause / resume**：`pause()` 暂停逻辑，但 RAF 继续跑（仍会调用
 *    `render` 以显示暂停画面，可后续按需拆分）。
 *
 * 与 [technical-architecture 5.1](../../.trae/documents/technical-architecture.md)
 * 描述的时序 (Input → AI → Movement → Collision → Spawn → Render → Audio)
 * 保持一致；本文件只提供框架，具体 System 由 T-06 起接入。
 */

import { FIXED_DT, MAX_STEPS_PER_FRAME } from './constants'

export type UpdateFn = (dt: number) => void
export type RenderFn = (ctx: CanvasRenderingContext2D, alpha: number) => void

export interface EngineStats {
  /** 每秒渲染帧数（渲染帧 = RAF 回调次数）。*/
  fps: number
  /** 逻辑帧率（每秒执行的 update 次数），期望值 = 60。*/
  ups: number
  /** 最近一次 RAF 的实际 delta（毫秒）。*/
  frameMs: number
  /** 累积至今的运行时间（秒）。*/
  time: number
}

export type StatsListener = (stats: EngineStats) => void

/** 单帧最大允许时间（秒），超过则视为「长阻塞」并强制丢帧。250ms 是常见阈值。*/
const MAX_FRAME_DELTA = 0.25

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null

  private updateFn: UpdateFn = () => {}
  private renderFn: RenderFn = () => {}

  private rafId = 0
  private running = false
  private paused = false

  private lastTime = 0
  private acc = 0

  // ─── 统计 ───────────────────────────────────────────────────────────────
  /** 已发布的稳定快照；每次结算生成新对象，React useSyncExternalStore 靠此判等。*/
  private publishedStats: EngineStats = { fps: 0, ups: 0, frameMs: 0, time: 0 }
  private statsListeners = new Set<StatsListener>()
  private frameCounter = 0
  private updateCounter = 0
  private statsTimer = 0
  private lastFrameMs = 0
  private totalTime = 0

  // ─── 生命周期 ──────────────────────────────────────────────────────────

  /** 将引擎挂载到目标 canvas 上；重复挂载会先自动 unmount。*/
  mount(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return
    if (this.canvas) this.unmount()
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('[GameEngine] Failed to get 2d rendering context.')
    this.canvas = canvas
    this.ctx = ctx
    // 保证像素艺术不被浏览器插值。
    this.ctx.imageSmoothingEnabled = false
  }

  unmount(): void {
    this.stop()
    this.canvas = null
    this.ctx = null
  }

  /** 注入逻辑更新回调；每个 fixed step 触发一次。*/
  setUpdate(fn: UpdateFn): void {
    this.updateFn = fn
  }

  /** 注入渲染回调；每个 RAF 触发一次，`alpha` 为当前 acc / FIXED_DT ∈ [0,1)，用于插值。*/
  setRender(fn: RenderFn): void {
    this.renderFn = fn
  }

  // ─── 控制 ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return
    if (!this.canvas || !this.ctx) {
      throw new Error('[GameEngine] Call mount(canvas) before start().')
    }
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.acc = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    // 恢复后重置计时基线，避免瞬间累积一大堆逻辑步。
    this.lastTime = performance.now()
    this.acc = 0
  }

  isRunning(): boolean {
    return this.running
  }

  isPaused(): boolean {
    return this.paused
  }

  // ─── 统计订阅 ──────────────────────────────────────────────────────────

  subscribeStats(listener: StatsListener): () => void {
    this.statsListeners.add(listener)
    // 立刻回调一次当前值，避免订阅者首屏空白。
    listener(this.publishedStats)
    return () => {
      this.statsListeners.delete(listener)
    }
  }

  getStats(): EngineStats {
    return this.publishedStats
  }

  private emitStats(fps: number, ups: number): void {
    // 每次结算生成新对象引用，让 useSyncExternalStore 能感知变化。
    this.publishedStats = {
      fps,
      ups,
      frameMs: this.lastFrameMs,
      time: this.totalTime,
    }
    for (const l of this.statsListeners) l(this.publishedStats)
  }

  // ─── RAF 主循环 ────────────────────────────────────────────────────────

  private tick = (now: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.tick)

    // deltaSeconds 为本次 RAF 相对上一次的实际时间。
    let deltaSeconds = (now - this.lastTime) / 1000
    this.lastTime = now
    // 长阻塞（切换 tab 回来）时避免疯狂追帧。
    if (deltaSeconds > MAX_FRAME_DELTA) deltaSeconds = MAX_FRAME_DELTA

    this.lastFrameMs = deltaSeconds * 1000
    this.totalTime += deltaSeconds
    this.frameCounter++

    // 固定步长逻辑更新，最多追 MAX_STEPS_PER_FRAME 步。
    if (!this.paused) {
      this.acc += deltaSeconds
      let steps = 0
      while (this.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        this.updateFn(FIXED_DT)
        this.acc -= FIXED_DT
        steps++
        this.updateCounter++
      }
      // 若仍然溢出，丢弃剩余积压，避免 spiral of death。
      if (this.acc > FIXED_DT) this.acc = 0
    }

    // 渲染：始终执行；alpha 用于位置插值（本迭代未使用）。
    if (this.ctx) {
      const alpha = this.paused ? 0 : this.acc / FIXED_DT
      this.renderFn(this.ctx, alpha)
    }

    // 每秒结算一次 fps / ups 并广播。
    this.statsTimer += deltaSeconds
    if (this.statsTimer >= 1) {
      const fps = Math.round(this.frameCounter / this.statsTimer)
      const ups = Math.round(this.updateCounter / this.statsTimer)
      this.frameCounter = 0
      this.updateCounter = 0
      this.statsTimer = 0
      this.emitStats(fps, ups)
    }
  }
}
