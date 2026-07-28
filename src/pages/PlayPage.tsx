import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '@/layouts/StageLayout'
import GameCanvas from '@/components/GameCanvas'
import GameHUD from '@/components/GameHUD'
import {
  GameCompleteOverlay,
  type GameCompleteInfo,
  GameOverOverlay,
  type GameOverInfo,
  NameEntryOverlay,
  PauseOverlay,
  StageClearOverlay,
  type StageClearInfo,
} from '@/components/overlays'
import { PLAYER_INITIAL_LIVES, STAGE_CLEAR_DURATION } from '@/game/constants'
import { DEFAULT_LEVEL, LEVELS } from '@/game/maps/levels'
import type { EngineStats } from '@/game/GameEngine'
import type { InputIntent, LevelDefinition, PowerUpKind, Tank } from '@/game/types'
import {
  insert as insertLeaderboard,
  qualifies,
  sanitizeName,
  save as saveLeaderboard,
} from '@/lib/leaderboard'

/**
 * PlayPage —— T-12 起把"单纯战场画布"升级成完整的一局；T-15 起打通
 * 5 关完整流程 + 一周目通关：
 *   playing → stage-clear（结算 + 自动切下一关）↺
 *   playing → stage-clear（末关）→ game-complete（一周目通关庆祝）
 *   playing → game-over（基地毁 or 3 命耗尽，允许 RETRY / 回菜单）
 *
 * 关键状态：
 * - [phase](#L51-L51)：顶层场景阶段。切到非 'playing' 会通知 GameCanvas 冻结世界。
 * - [levelIndex](#L67-L67)：当前关卡在 [LEVELS](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/maps/levels.ts) 里的下标。
 *   stage-clear 后若不是末关则 +1 前进；若是末关则进入 game-complete。
 * - [resetKey](#L69-L69)：整局重开计数器，改变即触发 GameCanvas 清 session。
 *
 * 终局分叉说明（T-15）：
 *   stage-clear 定时器到点，先看 `stageClearInfo.stageId === LEVELS[last].id`：
 *   是 → phase = 'game-complete'（保留 GameCanvas 冻结世界）
 *   否 → levelIndex += 1，phase = 'playing'（GameCanvas 内部 softReset）
 */

type Phase = 'playing' | 'paused' | 'stage-clear' | 'game-over' | 'game-complete'

const INITIAL_STATS: EngineStats = { fps: 0, ups: 0, frameMs: 0, time: 0 }
const INITIAL_INTENT: InputIntent = { dir: null, fire: false, pausePressed: false }
const INITIAL_TANK: Pick<Tank, 'x' | 'y' | 'dir' | 'level' | 'hp' | 'invulnerable' | 'cooldown'> = {
  x: 0,
  y: 0,
  dir: 'up',
  level: 0,
  hp: 1,
  invulnerable: 0,
  cooldown: 0,
}

interface EnemiesInfo {
  field: number
  queue: number
  totalSpawned: number
}

export default function PlayPage() {
  const [levelIndex, setLevelIndex] = useState(0)
  const level: LevelDefinition = LEVELS[levelIndex] ?? DEFAULT_LEVEL
  const [phase, setPhase] = useState<Phase>('playing')
  const [resetKey, setResetKey] = useState(0)
  const [stats, setStats] = useState<EngineStats>(INITIAL_STATS)
  const [intent, setIntent] = useState<InputIntent>(INITIAL_INTENT)
  const [tank, setTank] =
    useState<Pick<Tank, 'x' | 'y' | 'dir' | 'level' | 'hp' | 'invulnerable' | 'cooldown'>>(
      INITIAL_TANK,
    )
  const [paused, setPaused] = useState(false)
  const [bulletsAlive, setBulletsAlive] = useState(0)
  const [baseDown, setBaseDown] = useState(false)
  const [enemies, setEnemies] = useState<EnemiesInfo>({
    field: 0,
    queue: level.enemyQueue.length,
    totalSpawned: 0,
  })
  const [lives, setLives] = useState(PLAYER_INITIAL_LIVES)
  const [score, setScore] = useState(0)
  /**
   * T-17：HUD 面板用的一份"道具状态快照"。
   * - field：场上唯一道具（null 表示无）；
   * - freezeTimer / shovelTimer / helmetTimer：3 类"计时型 buff"的剩余秒；
   * - playerLevel：玩家火力等级（星道具累加）；
   * - collected：本局累计拾取道具数（HUD 展示 & 未来接结算面板）。
   */
  const [powerUp, setPowerUp] = useState<{
    field: { kind: PowerUpKind; lifetime: number } | null
    freezeTimer: number
    shovelTimer: number
    helmetTimer: number
    playerLevel: number
    collected: number
  }>({
    field: null,
    freezeTimer: 0,
    shovelTimer: 0,
    helmetTimer: 0,
    playerLevel: 0,
    collected: 0,
  })
  const [stageClearInfo, setStageClearInfo] = useState<StageClearInfo | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  /**
   * game-complete 面板需要的一份"整局快照"：一周目 5 关全通时 stage-clear
   * 结算面板停在最后一关的数据上，通关面板则展示"最终总分 + 最终关卡编号"，
   * 二者在同一 phase 上会打架，因此各持一份 state。
   */
  const [gameCompleteInfo, setGameCompleteInfo] = useState<GameCompleteInfo | null>(null)

  const handleStats = useCallback((s: EngineStats) => setStats(s), [])
  const handleInput = useCallback((i: InputIntent) => setIntent(i), [])
  const handlePause = useCallback((p: boolean) => {
    setPaused(p)
    // ESC 暂停只影响 UI 提示；phase 保持 'playing'，GameCanvas 内部的 engine.pause() 已经处理停帧。
  }, [])
  const handleTank = useCallback((t: Tank) => {
    setTank({
      x: t.x,
      y: t.y,
      dir: t.dir,
      level: t.level,
      hp: t.hp,
      invulnerable: t.invulnerable,
      cooldown: t.cooldown,
    })
  }, [])
  const handleBullets = useCallback((alive: number) => setBulletsAlive(alive), [])
  const handleBaseHit = useCallback(() => setBaseDown(true), [])
  const handleEnemies = useCallback((info: EnemiesInfo) => setEnemies(info), [])
  const handleScore = useCallback((s: number) => setScore(s), [])
  const handleLives = useCallback((l: number) => setLives(l), [])
  const handlePowerUp = useCallback(
    (info: {
      field: { kind: PowerUpKind; lifetime: number } | null
      freezeTimer: number
      shovelTimer: number
      helmetTimer: number
      playerLevel: number
      collected: number
    }) => setPowerUp(info),
    [],
  )
  const handleStageCleared = useCallback((info: StageClearInfo) => {
    setStageClearInfo(info)
    setPhase('stage-clear')
  }, [])
  const handleGameOver = useCallback((info: GameOverInfo) => {
    setGameOverInfo(info)
    setPhase('game-over')
  }, [])

  /**
   * stage-clear：等待 STAGE_CLEAR_DURATION 秒，做一次终局分叉判定：
   * - 若当前是最后一关（levelIndex === LEVELS.length - 1），直接进 game-complete；
   *   注意：这里读的是 levelIndex，而非 stageId，避免"跳关调试"等情况下判错。
   * - 否则：levelIndex +1，phase 回 'playing'；GameCanvas useEffect([level]) 会
   *   自动 softReset（清 enemies/bullets/map，保留 lives/score）。
   */
  useEffect(() => {
    if (phase !== 'stage-clear') return
    const timer = window.setTimeout(() => {
      const isLastStage = levelIndex >= LEVELS.length - 1
      if (isLastStage) {
        setGameCompleteInfo({
          finalScore: score,
          finalStageId: level.id,
        })
        setStageClearInfo(null)
        setPhase('game-complete')
      } else {
        setLevelIndex((idx) => idx + 1)
        setStageClearInfo(null)
        setBaseDown(false)
        setPhase('playing')
      }
    }, STAGE_CLEAR_DURATION * 1000)
    return () => window.clearTimeout(timer)
  }, [phase, levelIndex, score, level.id])

  /** RETRY：整局重开 —— 回到关卡 0，session 清零，phase 归 playing。 */
  const handleRetry = useCallback(() => {
    setLevelIndex(0)
    setResetKey((k) => k + 1)
    setStageClearInfo(null)
    setGameOverInfo(null)
    setGameCompleteInfo(null)
    setBaseDown(false)
    setLives(PLAYER_INITIAL_LIVES)
    setScore(0)
    setPhase('playing')
    setPendingRecord(null)
  }, [])

  /**
   * T-21：破纪录判定 & 昵称录入闸门。
   *
   * 一局结束（game-over / game-complete）进入 phase 的瞬间，判定当前 score
   * 是否入 Top10；若是则挂出 [NameEntryOverlay](file:///Users/puqingrui/workspace/Projects/TankWar/src/components/overlays/NameEntryOverlay.tsx)
   * 遮住 GameOver/Complete 覆盖层，等待玩家键盘输入 3 字母；提交后调用
   * [insertLeaderboard](file:///Users/puqingrui/workspace/Projects/TankWar/src/lib/leaderboard.ts#L112-L136) 落库并跳转到
   * /leaderboard?rank=N 让新条目闪烁高亮。
   *
   * 使用 `pendingRecord` 而不是布尔 —— 记录下"当时那局的分数/关卡"，避免
   * NameEntry 组件跟 PlayPage 的实时 score/level 产生同步问题。
   */
  const [pendingRecord, setPendingRecord] = useState<{ score: number; stageId: number } | null>(
    null,
  )
  const navigate = useNavigate()

  useEffect(() => {
    if (phase === 'game-over' && gameOverInfo && qualifies(gameOverInfo.score)) {
      setPendingRecord({ score: gameOverInfo.score, stageId: gameOverInfo.stageId })
    } else if (
      phase === 'game-complete' &&
      gameCompleteInfo &&
      qualifies(gameCompleteInfo.finalScore)
    ) {
      setPendingRecord({
        score: gameCompleteInfo.finalScore,
        stageId: gameCompleteInfo.finalStageId,
      })
    }
  }, [phase, gameOverInfo, gameCompleteInfo])

  const handleNameSubmit = useCallback(
    (name: string) => {
      if (!pendingRecord) return
      // 兵底 sanitize：NameEntryOverlay 键盘通道理论上只会产出 A-Z 三字母，
      // 但契约上任何入榜路径都必须经过清洗，保证数据一致性。
      const cleanName = sanitizeName(name)
      const { rank, list } = insertLeaderboard({
        name: cleanName,
        score: pendingRecord.score,
        stage: pendingRecord.stageId,
        createdAt: Date.now(),
      })
      saveLeaderboard(list)
      setPendingRecord(null)
      navigate(rank > 0 ? `/leaderboard?rank=${rank}` : '/leaderboard')
    },
    [pendingRecord, navigate],
  )

  const enemiesLeft = enemies.field + enemies.queue
  const subtitle = useMemo(() => {
    if (phase === 'game-complete') return 'MISSION COMPLETE'
    if (phase === 'game-over') return 'GAME OVER'
    if (phase === 'stage-clear') return 'STAGE CLEAR'
    if (baseDown) return 'BASE DESTROYED'
    if (paused) return 'PAUSED'
    return `${enemiesLeft} ENEMIES LEFT`
  }, [phase, baseDown, paused, enemiesLeft])

  return (
    <StageLayout title={level.name} subtitle={subtitle} showBack>
      <div className="flex h-full w-full items-center gap-4">
        <div className="relative">
          <GameCanvas
            level={level}
            phase={phase}
            resetSessionKey={resetKey}
            onStats={handleStats}
            onInput={handleInput}
            onTankChange={handleTank}
            onPauseChange={handlePause}
            onBulletsChange={handleBullets}
            onEnemiesChange={handleEnemies}
            onBaseHit={handleBaseHit}
            onScoreChange={handleScore}
            onLivesChange={handleLives}
            onPowerUpChange={handlePowerUp}
            onStageCleared={handleStageCleared}
            onGameOver={handleGameOver}
          />

          {phase === 'playing' && paused && <PauseOverlay />}
          {phase === 'stage-clear' && stageClearInfo && (
            <StageClearOverlay
              info={stageClearInfo}
              isFinalStage={levelIndex >= LEVELS.length - 1}
            />
          )}
          {phase === 'game-over' && gameOverInfo && !pendingRecord && (
            <GameOverOverlay info={gameOverInfo} onRetry={handleRetry} />
          )}
          {phase === 'game-complete' && gameCompleteInfo && !pendingRecord && (
            <GameCompleteOverlay info={gameCompleteInfo} onRetry={handleRetry} />
          )}
          {pendingRecord && (phase === 'game-over' || phase === 'game-complete') && (
            <NameEntryOverlay
              score={pendingRecord.score}
              stageId={pendingRecord.stageId}
              onSubmit={handleNameSubmit}
            />
          )}
        </div>

        <GameHUD
          level={level}
          enemies={enemies}
          lives={lives}
          score={score}
          powerUp={powerUp}
          tank={tank}
          bulletsAlive={bulletsAlive}
          baseDown={baseDown}
          stats={stats}
          intent={intent}
          paused={paused}
          phase={phase}
        />
      </div>
    </StageLayout>
  )
}
