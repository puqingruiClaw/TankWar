import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StageLayout from '@/layouts/StageLayout'
import { LEADERBOARD_MAX_ENTRIES } from '@/game/constants'
import { clear as clearLeaderboard, load, type LeaderboardEntry } from '@/lib/leaderboard'

/**
 * LeaderboardPage —— T-21 完整实现。
 *
 * 数据来源：[leaderboard.load](file:///Users/puqingrui/workspace/Projects/TankWar/src/lib/leaderboard.ts#L64-L82)
 * 会读取 localStorage 键 `tankwar_leaderboard`（PRD §2.3）；表格始终渲染
 * [LEADERBOARD_MAX_ENTRIES](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/constants.ts#L233-L233) 行，未填的位置用 "—— ——" 占位。
 *
 * 高亮：URL 查询串 `?rank=N` 让"刚刚破榜"的那一行闪烁，方便玩家一眼定位。
 * PlayPage 提交昵称后会 [navigate('/leaderboard?rank=N')](file:///Users/puqingrui/workspace/Projects/TankWar/src/pages/PlayPage.tsx)。
 *
 * 清榜：CLEAR 键需要**两次确认**（第一次变红提示 "SURE?"，再点才真正清空），
 * 防止玩家手滑一键清空成就。T-25 UX 打磨：若进入 SURE? 状态后 5 秒内没有
 * 二次确认，会自动回退到普通 CLEAR，避免用户浏览榜单时"忘了自己刚点了什么"。
 */

const RANK_COLOR: Record<number, string> = {
  1: 'text-hud-accent',
  2: 'text-outline',
  3: 'text-terrain-brick',
}

const EMPTY_NAME = '---'
const EMPTY_NUM = '------'

export default function LeaderboardPage() {
  const [searchParams] = useSearchParams()
  const urlRank = Number(searchParams.get('rank') ?? '0') || 0
  // 高亮 rank：初始复制 URL 参数，但会在 5s 后自动清零（避免用户浏览榜单时永远闪烁分神）。
  const [highlightRank, setHighlightRank] = useState(urlRank)
  // 用一个计数器强制 load() 重新求值——CLEAR 之后不需要跳路由也能立即刷新表格。
  const [tick, setTick] = useState(0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (urlRank <= 0) return
    setHighlightRank(urlRank)
    const timer = window.setTimeout(() => setHighlightRank(0), 5000)
    return () => window.clearTimeout(timer)
  }, [urlRank])

  /**
   * T-25：CLEAR 进入 SURE? 状态后，5s 无操作自动回退。使用 5s 而非 3s，
   * 与破榜高亮 timer 保持一致；也给玩家足够时间读完确认文案再决定。
   */
  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 5000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  const entries = useMemo<LeaderboardEntry[]>(() => {
    // tick 是"手动缓存失效开关"——localStorage 不是 React state，hook 依赖分析
    // 无法感知它变化。CLEAR 后 setTick(t=>t+1) 会重跑此 memo。
    void tick
    return load()
  }, [tick])

  const handleClearClick = useCallback(() => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    clearLeaderboard()
    setConfirming(false)
    setTick((t) => t + 1)
  }, [confirming])

  const handleCancel = useCallback(() => setConfirming(false), [])

  return (
    <StageLayout title="TOP 10" subtitle="LOCAL LEADERBOARD" showBack>
      <div className="pixel-frame mx-auto w-[520px]">
        <table className="w-full font-pixel text-pixel-base text-white">
          <thead>
            <tr className="text-pixel-sm text-outline">
              <th className="w-16 text-left">RANK</th>
              <th className="text-left">NAME</th>
              <th className="w-24 text-right">SCORE</th>
              <th className="w-20 text-right">STAGE</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) => {
              const rank = i + 1
              const entry = entries[i]
              const isHighlight = rank === highlightRank && entry !== undefined
              const rowClass = [
                RANK_COLOR[rank] ?? '',
                isHighlight ? 'animate-blink bg-hud-accent/10' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr key={rank} className={rowClass}>
                  <td className="py-1">{rank.toString().padStart(2, '0')}</td>
                  <td>{entry?.name ?? EMPTY_NAME}</td>
                  <td className="text-right">
                    {entry ? entry.score.toString().padStart(6, '0') : EMPTY_NUM}
                  </td>
                  <td className="text-right">
                    {entry ? entry.stage.toString().padStart(2, '0') : '--'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-center font-pixel text-pixel-sm text-outline">
          SCORES ARE SAVED TO <span className="text-hud-accent">localStorage</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClearClick}
            className={
              'border-2 px-3 py-1 font-pixel text-pixel-sm ' +
              (confirming
                ? 'animate-blink border-hud-danger text-hud-danger'
                : 'border-outline text-outline hover:bg-outline/30')
            }
          >
            {confirming ? 'SURE? CLEAR ALL' : 'CLEAR'}
          </button>
          {confirming && (
            <button
              type="button"
              onClick={handleCancel}
              className="border-2 border-outline px-3 py-1 font-pixel text-pixel-sm text-white hover:bg-outline/30"
            >
              CANCEL
            </button>
          )}
        </div>
      </div>
    </StageLayout>
  )
}
