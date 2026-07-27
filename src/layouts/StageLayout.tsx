import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface StageLayoutProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  children: ReactNode
}

export default function StageLayout({
  title,
  subtitle,
  showBack = false,
  children,
}: StageLayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="stage crt-scanlines no-smoothing">
      <div className="flex h-full w-full flex-col p-tile">
        {(title || showBack) && (
          <header className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              {showBack && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="font-pixel text-pixel-sm text-outline hover:text-hud-accent"
                  aria-label="Back to menu"
                >
                  ← BACK
                </button>
              )}
              {title && <h1 className="font-display text-pixel-xl text-tank-player">{title}</h1>}
            </div>
            {subtitle && <span className="font-pixel text-pixel-sm text-outline">{subtitle}</span>}
          </header>
        )}

        <main className="mt-4 flex-1">{children}</main>
      </div>
    </div>
  )
}
