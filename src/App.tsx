import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import MenuPage from '@/pages/MenuPage'
import PlayPage from '@/pages/PlayPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import HelpPage from '@/pages/HelpPage'
import { useAudioSettings } from '@/hooks/useAudio'
import { useEffect } from 'react'

/**
 * 全局音频钩子：把 localStorage 里的 muted/volume 同步到 AudioSystem 单例，
 * 并注册 `M` 键做"任何页面下的一键静音"。这些属于"跨路由级别"的持久化设置，
 * 因此只能挂在 App 层，路由组件切换不会影响它。
 */
function GlobalAudio() {
  const { muted, toggleMuted } = useAudioSettings()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 只响应无修饰键的 M；避免与浏览器 Cmd+M（Mac 最小化窗口）冲突。
      if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        toggleMuted()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleMuted])
  // 只在 debug 里读一下 muted 保证 lint 满意；实际同步在 hook 内部完成。
  void muted
  return null
}

export default function App() {
  return (
    <HashRouter>
      <GlobalAudio />
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
