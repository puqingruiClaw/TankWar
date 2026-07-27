/**
 * useGameLoop —— 把 GameEngine 生命周期挂到 React 组件树。
 *
 * 用法：
 * ```tsx
 * const canvasRef = useRef<HTMLCanvasElement>(null)
 * const { engine, stats } = useGameLoop(canvasRef, {
 *   onUpdate: (dt) => world.step(dt),
 *   onRender: (ctx) => world.draw(ctx),
 * })
 * ```
 *
 * 组件挂载时创建引擎、绑定 canvas 并 start()；卸载时自动 stop() + unmount()。
 * stats 通过 useSyncExternalStore 订阅，避免每帧 setState 触发重渲染，
 * 只在引擎每秒结算 fps/ups 时才推送一次。
 */

import { useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react'
import { GameEngine, type EngineStats, type RenderFn, type UpdateFn } from '@/game/GameEngine'

export interface UseGameLoopOptions {
  onUpdate?: UpdateFn
  onRender?: RenderFn
  /** 是否自动启动，默认 true。*/
  autoStart?: boolean
}

const EMPTY_STATS: EngineStats = { fps: 0, ups: 0, frameMs: 0, time: 0 }

export function useGameLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { onUpdate, onRender, autoStart = true }: UseGameLoopOptions = {},
) {
  // 每个组件实例持有一个引擎；useMemo 保证 Strict Mode 双调用下也稳定。
  const engine = useMemo(() => new GameEngine(), [])
  // 用 ref 存回调，让外部传入的最新闭包也能被引擎读到，但引擎自身不重挂。
  const updateRef = useRef<UpdateFn>(() => {})
  const renderRef = useRef<RenderFn>(() => {})
  updateRef.current = onUpdate ?? (() => {})
  renderRef.current = onRender ?? (() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    engine.mount(canvas)
    engine.setUpdate((dt) => updateRef.current(dt))
    engine.setRender((ctx, alpha) => renderRef.current(ctx, alpha))
    if (autoStart) engine.start()
    return () => {
      engine.unmount()
    }
    // engine 是 useMemo 产物，稳定引用；canvasRef 只在挂载点读取。
  }, [engine, canvasRef, autoStart])

  const stats = useSyncExternalStore(
    (listener) => engine.subscribeStats(listener),
    () => engine.getStats(),
    () => EMPTY_STATS,
  )

  return { engine, stats }
}
