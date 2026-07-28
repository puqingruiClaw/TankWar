/**
 * PauseOverlay —— T-20 引入的暂停覆盖层。
 *
 * PRD §2.3：Esc 呼出，半透明遮罩 + "PAUSE" 大字，Esc/Enter 继续。
 *
 * 关键设计：
 * - 组件是无状态展示层：可见性由父级 [PlayPage](file:///Users/puqingrui/workspace/Projects/TankWar/src/pages/PlayPage.tsx)
 *   根据 `paused` 布尔条件挂载/卸载即可，避免 Overlay 内部维护"打开/关闭"状态。
 * - 点击事件用 `pointer-events-none`：Esc 键仍由 GameCanvas 的 keydown 通道处理，
 *   Overlay 不拦截键盘/鼠标输入。
 * - "PAUSE" 用 `animate-blink` 呼吸，符合 8-bit 街机常用暂停闪烁效果。
 */
export default function PauseOverlay() {
  return (
    <div
      aria-label="Paused"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/60 font-pixel text-white"
    >
      <p className="animate-blink text-pixel-3xl text-hud-accent">PAUSE</p>
      <p className="mt-6 text-pixel-sm text-outline">ESC / ENTER TO RESUME</p>
    </div>
  )
}
