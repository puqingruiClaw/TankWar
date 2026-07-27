import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import MenuPage from '@/pages/MenuPage'
import PlayPage from '@/pages/PlayPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import HelpPage from '@/pages/HelpPage'

export default function App() {
  return (
    <HashRouter>
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
