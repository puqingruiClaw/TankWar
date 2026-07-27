import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface MenuItem {
  label: string
  to: string
}

const MENU_ITEMS: readonly MenuItem[] = [
  { label: '1 PLAYER', to: '/play' },
  { label: 'LEADERBOARD', to: '/leaderboard' },
  { label: 'HELP', to: '/help' },
] as const

export default function MenuPage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          setIndex((i) => (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          setIndex((i) => (i + 1) % MENU_ITEMS.length)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          navigate(MENU_ITEMS[index].to)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, navigate])

  return (
    <div className="stage crt-scanlines no-smoothing">
      <div className="flex h-full w-full flex-col items-center p-tile">
        <header className="mt-tile text-center">
          <h1 className="font-display text-pixel-3xl text-tank-player">BATTLE</h1>
          <h1 className="font-display text-pixel-3xl text-white">CITY</h1>
          <p className="mt-3 font-pixel text-pixel-sm text-outline">
            坦克大战 · v0.1 · WEB EDITION
          </p>
        </header>

        <section className="mt-tile-2 pixel-frame pixel-frame--accent w-64">
          <ul className="flex flex-col gap-3">
            {MENU_ITEMS.map((item, i) => {
              const active = i === index
              return (
                <li
                  key={item.to}
                  className={
                    'font-pixel text-pixel-lg ' +
                    (active ? 'pixel-cursor text-hud-accent' : 'pl-6 text-white')
                  }
                >
                  <button
                    type="button"
                    onClick={() => navigate(item.to)}
                    onMouseEnter={() => setIndex(i)}
                    className="bg-transparent p-0 font-pixel text-pixel-lg text-inherit"
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <footer className="mt-auto text-center font-pixel text-pixel-sm text-outline">
          <p>
            <span className="text-hud-accent">↑↓</span> SELECT ·{' '}
            <span className="text-hud-accent">ENTER</span> CONFIRM
          </p>
          <p className="mt-2 animate-blink text-white">— PRESS ENTER —</p>
        </footer>
      </div>
    </div>
  )
}
