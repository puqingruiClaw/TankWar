import StageLayout from '@/layouts/StageLayout'

export default function PlayPage() {
  return (
    <StageLayout title="STAGE 01" subtitle="20 ENEMIES LEFT" showBack>
      <div className="flex h-full w-full items-center gap-4">
        {/* Battle canvas placeholder — 416x416 (13 tiles × 32px) */}
        <div className="flex h-canvas w-canvas items-center justify-center border-2 border-outline bg-black">
          <span className="font-pixel text-pixel-base text-outline">[ CANVAS PLACEHOLDER ]</span>
        </div>

        {/* HUD sidebar — 224px wide, per PRD 4.2 */}
        <aside className="flex h-canvas w-hud flex-col justify-between p-3 pixel-frame">
          <div>
            <p className="font-pixel text-pixel-sm text-outline">ENEMIES</p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="h-3 w-3 bg-tank-enemyBasic" aria-hidden />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">1P</p>
            <p className="font-pixel text-pixel-lg text-hud-accent">♥♥♥</p>
          </div>

          <div className="mt-4">
            <p className="font-pixel text-pixel-sm text-outline">STAGE</p>
            <p className="font-pixel text-pixel-2xl text-white">01</p>
          </div>

          <p className="mt-auto animate-blink font-pixel text-pixel-sm text-hud-accent">READY?</p>
        </aside>
      </div>
    </StageLayout>
  )
}
