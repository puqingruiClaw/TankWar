import type { EngineStats } from '@/game/GameEngine'
import type { InputIntent, LevelDefinition, PowerUpKind, Tank } from '@/game/types'
import {
  PLAYER_MAX_BULLETS,
  POWERUP_CLOCK_DURATION,
  POWERUP_HELMET_DURATION,
  POWERUP_SHOVEL_DURATION,
  TANK_COOLDOWN,
  TILE_SIZE,
} from '@/game/constants'
import { STAGE_HINTS, TOTAL_STAGES } from '@/game/maps/levels'

/**
 * GameHUD —— T-19：把原先内嵌在 PlayPage 里的一整块 <aside> HUD 抽出为独立组件。
 *
 * 设计目标（对应 schedule-and-roles.md 中 T-19 定义）：
 *   ┌── 主区（PRD 层面必备的 4 项）──────────────────────────────┐
 *   │ 1) STAGE   —— 当前关卡编号 + 总关数 + 关卡名/hint         │
 *   │ 2) ENEMIES —— 剩余敌军图标网格 + 场上 / 待生成 数字      │
 *   │ 3) 1P      —— 玩家生命：♥ 图标序列 + LIVES 数字          │
 *   │ 4) SCORE   —— 六位补零的当前得分                          │
 *   └────────────────────────────────────────────────────────────┘
 *   附加区（T-17 起需要的道具状态）：POWER-UP + 3 条 BuffBar
 *   调试区（保留自 T-08 起累加的观测能力）：TANK / BULLETS / BASE / ENGINE / INPUT
 *
 * 组件契约：
 *   - 纯展示层：不持有 useState / useEffect / ref；数据全部经 props 注入。
 *   - 视觉锁死：内部依赖的所有工具类（w-hud / h-canvas / pixel-frame / animate-blink…）都来
 *     自项目现有主题（[tailwind.config.js](file:///Users/puqingrui/workspace/Projects/TankWar/tailwind.config.js)），T-19 未新增任何主题项。
 *   - 未来 2P 模式：把 lives / score / tank / bulletsAlive 换成"每玩家一份"即可复用本组件的
 *     "1P" 分区结构。
 */

const DIR_LABEL: Record<'up' | 'down' | 'left' | 'right', string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

/**
 * 6 种道具 kind 的短标签（保留 T-17 里同名映射，随 HUD 一起搬迁）。
 * 大写 3-6 字母，与 SCORE / STAGE 面板的 pixel 字号一致。
 */
const POWERUP_KIND_LABEL: Record<PowerUpKind, string> = {
  star: 'STAR',
  helmet: 'HELMET',
  bomb: 'BOMB',
  shovel: 'SHOVEL',
  clock: 'CLOCK',
  tank: 'TANK',
}

/** HUD 里"1P 生命"分区的 ♥ 上限，超过上限退化为数字，避免溢出到下一列。 */
const HEART_ICON_CAP = 5

export interface PowerUpHUDInfo {
  field: { kind: PowerUpKind; lifetime: number } | null
  freezeTimer: number
  shovelTimer: number
  helmetTimer: number
  playerLevel: number
  collected: number
}

/**
 * HUD 内部展示所需的 Tank 视图。刻意收窄成 `Pick`，减少 PlayPage 把整只
 * Tank 结构（含 hp/物理速度等）都下发时的耦合面。
 */
export type HUDTankSnapshot = Pick<Tank, 'x' | 'y' | 'dir' | 'level' | 'invulnerable' | 'cooldown'>

export interface GameHUDProps {
  /** 当前关卡定义（读 id / name / tag / enemyQueue.length）。 */
  level: LevelDefinition
  /** 场上 & 待生成敌军数量的快照。 */
  enemies: { field: number; queue: number; totalSpawned: number }
  /** 玩家剩余生命（<0 时按 0 处理，图标序列自动裁剪）。 */
  lives: number
  /** 当前得分（会自动 6 位补零）。 */
  score: number
  /** 场上唯一道具 & 3 类 buff 剩余秒 & 累计等级/拾取。 */
  powerUp: PowerUpHUDInfo
  /** 玩家坦克视图（用于调试区展示位置/朝向/护盾/冷却）。 */
  tank: HUDTankSnapshot
  /** 玩家场上存活子弹数。 */
  bulletsAlive: number
  /** 基地是否已被摧毁。 */
  baseDown: boolean
  /** 引擎统计（FPS / UPS / 帧耗时 / 已运行秒）。 */
  stats: EngineStats
  /** 玩家最新输入意图（DIR / FIRE）。 */
  intent: InputIntent
  /** 是否处于 ESC 暂停状态；HUD 末行提示会随之切换。 */
  paused: boolean
  /** 顶层场景阶段字符串，用于 STATE 行的短标签展示。 */
  phase: string
}

/**
 * T-19：主入口。整个 HUD 走一个 <aside> 承载，宽 hud（224px）、高 canvas（416px），
 * 与战场画布并排；使用 pixel-frame 描像素双线边框。
 */
export default function GameHUD(props: GameHUDProps) {
  const {
    level,
    enemies,
    lives,
    score,
    powerUp,
    tank,
    bulletsAlive,
    baseDown,
    stats,
    intent,
    paused,
    phase,
  } = props

  const totalEnemies = level.enemyQueue.length
  const spawnedCount = Math.min(totalEnemies, enemies.totalSpawned)
  const tankCol = Math.floor(tank.x / TILE_SIZE)
  const tankRow = Math.floor(tank.y / TILE_SIZE)
  const shieldOn = tank.invulnerable > 0
  const cooldownPct = Math.min(100, Math.round((tank.cooldown / TANK_COOLDOWN.PLAYER) * 100))

  return (
    <aside
      aria-label="Game HUD"
      className="pixel-frame flex h-canvas w-hud flex-col justify-between p-3"
    >
      <EnemiesPanel
        total={totalEnemies}
        spawned={spawnedCount}
        field={enemies.field}
        queue={enemies.queue}
      />

      <LifePanel lives={lives} />

      <ScorePanel score={score} />

      <PowerUpPanel info={powerUp} />

      <StagePanel level={level} />

      <TankPanel
        col={tankCol}
        row={tankRow}
        dir={tank.dir}
        level={tank.level}
        shieldOn={shieldOn}
        shieldSec={tank.invulnerable}
      />

      <BulletsPanel alive={bulletsAlive} cooldownPct={cooldownPct} cooldown={tank.cooldown} />

      <BasePanel down={baseDown} />

      <EnginePanel stats={stats} />

      <InputPanel intent={intent} paused={paused} phase={phase} />

      <p className="mt-2 animate-blink font-pixel text-pixel-sm text-hud-accent">
        {paused ? 'ESC=RESUME' : 'ESC=PAUSE'}
      </p>
    </aside>
  )
}

/* ─────────────────────── 主区：ENEMIES / 1P / SCORE / STAGE ─────────────────────── */

/**
 * 敌军剩余分区：4×N 的方块图标网格 + 场上/队列的数字辅助。
 * - `spawned` 之前的格子被涂灰（表示"已经出场消耗掉的名额"）；
 * - 剩下的格子保持敌军基础色，一眼看清"这关还剩多少台"。
 */
function EnemiesPanel({
  total,
  spawned,
  field,
  queue,
}: {
  total: number
  spawned: number
  field: number
  queue: number
}) {
  return (
    <div>
      <p className="font-pixel text-pixel-sm text-outline">ENEMIES</p>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const consumed = i < spawned
          return (
            <div
              key={i}
              className={`h-3 w-3 ${consumed ? 'bg-outline opacity-40' : 'bg-tank-enemyBasic'}`}
              aria-hidden
            />
          )
        })}
      </div>
      <p className="mt-2 font-pixel text-pixel-sm text-white">
        FIELD <span className="text-tank-enemyBasic">{field}</span>
        <span className="ml-2">
          QUEUE <span className="text-hud-accent">{queue}</span>
        </span>
      </p>
    </div>
  )
}

/**
 * 玩家生命分区（HUD 里叫 "1P"，与 MenuPage 顶栏 I-PLAYER 保持措辞统一）。
 * 生命数 ≤ HEART_ICON_CAP 时用连排 ♥；超上限时退化到 "♥×N"，防止占宽度。
 */
function LifePanel({ lives }: { lives: number }) {
  const safeLives = Math.max(0, lives)
  return (
    <div className="mt-4">
      <p className="font-pixel text-pixel-sm text-outline">1P</p>
      <p className="font-pixel text-pixel-lg text-hud-accent">
        {safeLives === 0
          ? '·'
          : safeLives <= HEART_ICON_CAP
            ? '♥'.repeat(safeLives)
            : `♥×${safeLives}`}
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        LIVES <span className="text-hud-accent">{safeLives}</span>
      </p>
    </div>
  )
}

/** 6 位补零的当前得分，配黄色高亮 —— HUD 中视觉分量最大的一格。 */
function ScorePanel({ score }: { score: number }) {
  return (
    <div className="mt-4">
      <p className="font-pixel text-pixel-sm text-outline">SCORE</p>
      <p className="font-pixel text-pixel-2xl text-hud-accent">
        {score.toString().padStart(6, '0')}
      </p>
    </div>
  )
}

/** 关卡分区：编号 + 总关数 + 可选 tag / hint。 */
function StagePanel({ level }: { level: LevelDefinition }) {
  return (
    <div className="mt-4">
      <p className="font-pixel text-pixel-sm text-outline">STAGE</p>
      <p className="font-pixel text-pixel-2xl text-white">
        {level.id.toString().padStart(2, '0')}
        <span className="ml-2 text-pixel-sm text-outline">
          / {TOTAL_STAGES.toString().padStart(2, '0')}
        </span>
      </p>
      {level.tag && <p className="mt-1 font-pixel text-pixel-sm text-hud-accent">{level.tag}</p>}
      {STAGE_HINTS[level.id] && (
        <p className="mt-1 font-pixel text-pixel-sm leading-snug text-white">
          <span className="text-outline">HINT </span>
          {STAGE_HINTS[level.id]}
        </p>
      )}
    </div>
  )
}

/* ─────────────────────── 附加区：POWER-UP ─────────────────────── */

/** 道具分区：场上道具 kind + 剩余秒；等级 & 累计拾取；3 条 buff 进度条。 */
function PowerUpPanel({ info }: { info: PowerUpHUDInfo }) {
  return (
    <div className="mt-4 border-t border-outline pt-2">
      <p className="font-pixel text-pixel-sm text-outline">POWER-UP</p>
      <p className="font-pixel text-pixel-sm text-white">
        FIELD{' '}
        <span className={info.field ? 'animate-blink text-hud-accent' : 'text-outline'}>
          {info.field
            ? `${POWERUP_KIND_LABEL[info.field.kind]} ${info.field.lifetime.toFixed(1)}s`
            : '---'}
        </span>
      </p>
      <p className="mt-1 font-pixel text-pixel-sm text-white">
        STAR LV <span className="text-hud-accent">{info.playerLevel}</span>
        <span className="ml-2 text-outline">GOT</span>{' '}
        <span className="text-hud-accent">{info.collected.toString().padStart(2, '0')}</span>
      </p>
      <BuffBar label="HELMET" seconds={info.helmetTimer} full={POWERUP_HELMET_DURATION} />
      <BuffBar label="CLOCK" seconds={info.freezeTimer} full={POWERUP_CLOCK_DURATION} />
      <BuffBar label="SHOVEL" seconds={info.shovelTimer} full={POWERUP_SHOVEL_DURATION} />
    </div>
  )
}

/**
 * BuffBar —— T-17 起服务于 3 类计时型 buff 的剩余时间水平进度条。
 *
 * 之所以随 HUD 一起搬迁：BuffBar 仅在 HUD 上下文里出现，跟随 HUD 组件文件同处，
 * 也让 PlayPage 的"数据编排层"更纯粹（不再承担 UI 局部组件的职责）。
 */
function BuffBar({ label, seconds, full }: { label: string; seconds: number; full: number }) {
  const on = seconds > 0
  const pct = full > 0 ? Math.max(0, Math.min(100, (seconds / full) * 100)) : 0
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className={`w-14 font-pixel text-pixel-sm ${on ? 'text-hud-accent' : 'text-outline'}`}>
        {label}
      </span>
      <div className="relative h-1 flex-1 bg-outline" aria-hidden>
        <div
          className="h-full bg-hud-accent transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-8 text-right font-pixel text-pixel-sm ${on ? 'text-hud-accent' : 'text-outline'}`}
      >
        {on ? `${seconds.toFixed(1)}s` : '--'}
      </span>
    </div>
  )
}

/* ─────────────────────── 调试区：TANK / BULLETS / BASE / ENGINE / INPUT ─────────────────────── */

function TankPanel({
  col,
  row,
  dir,
  level,
  shieldOn,
  shieldSec,
}: {
  col: number
  row: number
  dir: HUDTankSnapshot['dir']
  level: number
  shieldOn: boolean
  shieldSec: number
}) {
  return (
    <div className="mt-4 border-t border-outline pt-2">
      <p className="font-pixel text-pixel-sm text-outline">TANK</p>
      <p className="font-pixel text-pixel-sm text-white">
        POS{' '}
        <span className="text-hud-accent">
          {col.toString().padStart(2, '0')},{row.toString().padStart(2, '0')}
        </span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        FACE <span className="text-hud-accent">{DIR_LABEL[dir]}</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        LV <span className="text-hud-accent">{level}</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        SHIELD{' '}
        <span className={shieldOn ? 'animate-blink text-hud-accent' : 'text-outline'}>
          {shieldOn ? `${shieldSec.toFixed(1)}s` : 'OFF'}
        </span>
      </p>
    </div>
  )
}

function BulletsPanel({
  alive,
  cooldownPct,
  cooldown,
}: {
  alive: number
  cooldownPct: number
  cooldown: number
}) {
  return (
    <div className="mt-4 border-t border-outline pt-2">
      <p className="font-pixel text-pixel-sm text-outline">BULLETS</p>
      <p className="font-pixel text-pixel-sm text-white">
        LIVE{' '}
        <span className="text-hud-accent">
          {alive}/{PLAYER_MAX_BULLETS}
        </span>
      </p>
      <div className="mt-1 h-1 w-full bg-outline" aria-hidden>
        <div
          className="h-full bg-hud-accent transition-[width] duration-75"
          style={{ width: `${100 - cooldownPct}%` }}
        />
      </div>
      <p className="mt-1 font-pixel text-pixel-sm text-white">
        CD <span className="text-hud-accent">{cooldown.toFixed(2)}s</span>
      </p>
    </div>
  )
}

function BasePanel({ down }: { down: boolean }) {
  return (
    <div className="mt-4 border-t border-outline pt-2">
      <p className="font-pixel text-pixel-sm text-outline">BASE</p>
      <p className="font-pixel text-pixel-sm text-white">
        STATUS{' '}
        <span className={down ? 'animate-blink text-hud-accent' : 'text-white'}>
          {down ? 'DESTROYED' : 'OK'}
        </span>
      </p>
    </div>
  )
}

function EnginePanel({ stats }: { stats: EngineStats }) {
  return (
    <div className="mt-4 border-t border-outline pt-2">
      <p className="font-pixel text-pixel-sm text-outline">ENGINE</p>
      <p className="font-pixel text-pixel-sm text-white">
        FPS <span className="text-hud-accent">{stats.fps.toString().padStart(2, '0')}</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        UPS <span className="text-hud-accent">{stats.ups.toString().padStart(2, '0')}</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        DT <span className="text-hud-accent">{stats.frameMs.toFixed(1)}ms</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        T <span className="text-hud-accent">{stats.time.toFixed(0)}s</span>
      </p>
    </div>
  )
}

function InputPanel({
  intent,
  paused,
  phase,
}: {
  intent: InputIntent
  paused: boolean
  phase: string
}) {
  return (
    <div className="mt-2 border-t border-outline pt-2">
      <p className="font-pixel text-pixel-sm text-outline">INPUT</p>
      <p className="font-pixel text-pixel-sm text-white">
        DIR <span className="text-hud-accent">{intent.dir ? DIR_LABEL[intent.dir] : '·'}</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        FIRE <span className="text-hud-accent">{intent.fire ? 'ON' : '··'}</span>
      </p>
      <p className="font-pixel text-pixel-sm text-white">
        STATE{' '}
        <span className={paused ? 'text-hud-accent' : 'text-white'}>
          {paused ? 'PAUSE' : phase.toUpperCase()}
        </span>
      </p>
    </div>
  )
}
