import StageLayout from '@/layouts/StageLayout'

interface KeyRow {
  keys: string
  action: string
}

const P1_KEYS: readonly KeyRow[] = [
  { keys: '↑ ↓ ← →', action: 'MOVE' },
  { keys: 'SPACE', action: 'FIRE' },
  { keys: 'ESC', action: 'PAUSE' },
]

const RULES: readonly string[] = [
  'DESTROY ALL 20 ENEMY TANKS TO CLEAR A STAGE.',
  'PROTECT THE EAGLE — GAME OVER IF IT IS DESTROYED.',
  'PICK UP POWER-UPS TO GAIN STAR / TANK / HELMET / BOMB / SHOVEL / CLOCK.',
  'BRICK CAN BE DESTROYED · STEEL NEEDS LEVEL 3+ · WATER BLOCKS TANKS.',
]

export default function HelpPage() {
  return (
    <StageLayout title="HELP" subtitle="RULES & CONTROLS" showBack>
      <div className="grid grid-cols-2 gap-4">
        <section className="pixel-frame">
          <h2 className="mb-3 font-pixel text-pixel-lg text-hud-accent">CONTROLS</h2>
          <table className="w-full font-pixel text-pixel-base text-white">
            <tbody>
              {P1_KEYS.map((row) => (
                <tr key={row.action}>
                  <td className="py-1 pr-4 text-hud-accent">{row.keys}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 font-pixel text-pixel-sm text-outline">
            KEYS ARE REBINDABLE IN SETTINGS (T-25).
          </p>
        </section>

        <section className="pixel-frame">
          <h2 className="mb-3 font-pixel text-pixel-lg text-hud-accent">RULES</h2>
          <ul className="flex flex-col gap-2 font-pixel text-pixel-sm text-white">
            {RULES.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-tank-player">■</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 flex justify-center gap-6 font-pixel text-pixel-sm">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 bg-terrain-brick" aria-hidden />
          <span className="text-white">BRICK</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 bg-terrain-steel" aria-hidden />
          <span className="text-white">STEEL</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 bg-terrain-water" aria-hidden />
          <span className="text-white">WATER</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 bg-terrain-grass" aria-hidden />
          <span className="text-white">GRASS</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 bg-terrain-ice" aria-hidden />
          <span className="text-white">ICE</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 bg-terrain-base" aria-hidden />
          <span className="text-white">BASE</span>
        </span>
      </div>
    </StageLayout>
  )
}
