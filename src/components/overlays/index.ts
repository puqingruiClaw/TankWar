/**
 * overlays barrel —— T-20 引入。
 *
 * 把四个覆盖层组件与它们对外暴露的 info 类型集中在一处出口，
 * PlayPage 只需要 `import { PauseOverlay, StageClearOverlay, ... } from '@/components/overlays'`。
 */
export { default as PauseOverlay } from './PauseOverlay'
export { default as StageClearOverlay } from './StageClearOverlay'
export type { StageClearInfo, StageClearOverlayProps } from './StageClearOverlay'
export { default as GameOverOverlay } from './GameOverOverlay'
export type { GameOverInfo, GameOverOverlayProps } from './GameOverOverlay'
export { default as GameCompleteOverlay } from './GameCompleteOverlay'
export type { GameCompleteInfo, GameCompleteOverlayProps } from './GameCompleteOverlay'
