import StageLayout from '@/layouts/StageLayout'

interface Entry {
  rank: number
  name: string
  score: number
  stage: number
}

const PLACEHOLDER: readonly Entry[] = [
  { rank: 1, name: '---', score: 0, stage: 0 },
  { rank: 2, name: '---', score: 0, stage: 0 },
  { rank: 3, name: '---', score: 0, stage: 0 },
  { rank: 4, name: '---', score: 0, stage: 0 },
  { rank: 5, name: '---', score: 0, stage: 0 },
  { rank: 6, name: '---', score: 0, stage: 0 },
  { rank: 7, name: '---', score: 0, stage: 0 },
  { rank: 8, name: '---', score: 0, stage: 0 },
  { rank: 9, name: '---', score: 0, stage: 0 },
  { rank: 10, name: '---', score: 0, stage: 0 },
]

const RANK_COLOR: Record<number, string> = {
  1: 'text-hud-accent',
  2: 'text-outline',
  3: 'text-terrain-brick',
}

export default function LeaderboardPage() {
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
            {PLACEHOLDER.map((e) => (
              <tr key={e.rank} className={RANK_COLOR[e.rank] ?? ''}>
                <td className="py-1">{e.rank.toString().padStart(2, '0')}</td>
                <td>{e.name}</td>
                <td className="text-right">{e.score.toString().padStart(6, '0')}</td>
                <td className="text-right">{e.stage.toString().padStart(2, '0')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center font-pixel text-pixel-sm text-outline">
        SCORES ARE SAVED TO <span className="text-hud-accent">localStorage</span>
      </p>
    </StageLayout>
  )
}
