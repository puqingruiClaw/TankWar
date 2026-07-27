const paletteRows = [
  {
    title: 'Player & Enemies',
    swatches: [
      { name: 'Player', color: 'bg-tank-player' },
      { name: 'P2', color: 'bg-tank-player2' },
      { name: 'Basic', color: 'bg-tank-enemyBasic' },
      { name: 'Fast', color: 'bg-tank-enemyFast' },
      { name: 'Power', color: 'bg-tank-enemyPower' },
      { name: 'Armor', color: 'bg-tank-enemyArmor' },
    ],
  },
  {
    title: 'Terrain',
    swatches: [
      { name: 'Brick', color: 'bg-terrain-brick' },
      { name: 'Steel', color: 'bg-terrain-steel' },
      { name: 'Water', color: 'bg-terrain-water' },
      { name: 'Grass', color: 'bg-terrain-grass' },
      { name: 'Ice', color: 'bg-terrain-ice' },
      { name: 'Base', color: 'bg-terrain-base' },
    ],
  },
]

const menuItems = ['1 PLAYER', '2 PLAYERS', 'STAGE SELECT', 'HELP', 'LEADERBOARD'] as const

export default function Home() {
  return (
    <div className="stage crt-scanlines no-smoothing">
      <div className="flex h-full w-full flex-col p-tile">
        <header className="flex items-baseline justify-between">
          <h1 className="font-display text-pixel-xl text-tank-player">
            BATTLE <span className="text-white">CITY</span>
          </h1>
          <span className="font-pixel text-pixel-sm text-outline">v0.1 · T-02 PIXEL THEME</span>
        </header>

        <section className="mt-4 grid grid-cols-[1fr_auto] gap-4">
          <div className="pixel-frame pixel-frame--accent flex flex-col gap-2">
            {menuItems.map((label, i) => (
              <div
                key={label}
                className={
                  'font-pixel text-pixel-base text-white ' + (i === 0 ? 'pixel-cursor' : 'pl-6')
                }
              >
                {label}
              </div>
            ))}
          </div>

          <div className="pixel-frame flex flex-col items-center justify-center gap-2 min-w-[192px]">
            <div className="animate-pixel-pulse h-tile w-tile bg-terrain-brick" aria-hidden />
            <div className="font-pixel text-pixel-xs text-hud-accent">TILE 32×32</div>
            <div className="font-pixel text-pixel-xs text-outline">image-rendering: pixelated</div>
          </div>
        </section>

        <section className="mt-4 flex-1">
          {paletteRows.map((row) => (
            <div key={row.title} className="mt-2">
              <div className="font-pixel text-pixel-sm text-outline">{row.title}</div>
              <div className="mt-1 flex gap-2">
                {row.swatches.map((s) => (
                  <div key={s.name} className="flex flex-col items-center gap-1">
                    <div
                      className={s.color + ' h-6 w-6 border-2 border-black shadow-pixel-soft'}
                      aria-hidden
                    />
                    <span className="font-pixel text-pixel-xs text-white">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <footer className="mt-2 flex items-center justify-between">
          <span className="font-pixel text-pixel-sm text-white">
            <span className="text-hud-accent">↑↓←→</span> MOVE ·{' '}
            <span className="text-hud-accent">SPACE</span> FIRE ·{' '}
            <span className="text-hud-accent">ESC</span> PAUSE
          </span>
          <span className="font-pixel text-pixel-sm text-outline animate-blink">PRESS START</span>
        </footer>
      </div>
    </div>
  )
}
