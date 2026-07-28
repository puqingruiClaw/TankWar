/**
 * useAudio —— T-22 引入。把 [AudioSystem](../game/systems/AudioSystem.ts) 的
 * 命令式单例包装成 React 友好的 hooks。
 *
 * 职责拆分：
 * - [useAudioSettings](#L45-L96)：**唯一**负责把用户偏好（muted / volume）
 *   与 localStorage、AudioSystem 三方同步。整个 app 挂一次即可；本项目挂在
 *   App 层。
 * - [usePlaySfx](#L108-L114)：给业务组件的最小 API —— 返回一个稳定
 *   引用的 `play(id)`。不放 muted 的读写职责，避免耦合。
 * - [useBgm](#L127-L153)：控制 BGM 起停 & 压音；receive `active` 布尔（true =
 *   playing 相位，false = 停 or 压低）。
 *
 * localStorage schema（写入 SETTINGS_STORAGE_KEY 一个 JSON 对象）：
 *   { muted?: boolean; volume?: number }
 * 未来 T-25 打磨 UX 时可以往里加更多设置项，本 hook 只关心这两键，其他键会被
 * 保留不动。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { audio, type SfxId } from '@/game/systems/AudioSystem'
import { SETTINGS_STORAGE_KEY } from '@/game/constants'

interface AudioSettings {
  muted: boolean
  volume: number
}

const DEFAULT_SETTINGS: AudioSettings = { muted: false, volume: 0.6 }

/**
 * 防御式读取 SETTINGS_STORAGE_KEY 里的 audio 分片。任何解析失败都回退默认值——
 * 与 [leaderboard.load](../lib/leaderboard.ts#L71-L82) 一样，"数据源不可信"是
 * 前端持久化的底线原则。
 */
function loadSettings(): AudioSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    const obj = parsed as Record<string, unknown>
    const muted = typeof obj.muted === 'boolean' ? obj.muted : DEFAULT_SETTINGS.muted
    const v = Number(obj.volume)
    const volume = Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_SETTINGS.volume
    return { muted, volume }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * 部分覆盖式写回：读出旧 JSON，合并 audio 字段，再写回。防止踩掉未来其他键。
 */
function saveSettings(patch: Partial<AudioSettings>): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    const base: Record<string, unknown> =
      raw && typeof raw === 'string' && raw.startsWith('{')
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {}
    const merged = { ...base, ...patch }
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // 忽略：隐私模式或磁盘满都不该导致游戏崩溃。
  }
}

/**
 * 全局音频设置 hook。返回 { muted, volume, toggleMuted, setMuted, setVolume }。
 *
 * 挂载时自动把持久化设置同步到 AudioSystem；state 更新时同步 AudioSystem + localStorage。
 * 这个 hook 建议**只挂一次**（App 层）；其他组件靠 usePlaySfx 或直接读 audio 单例。
 */
export function useAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings>(() => loadSettings())

  useEffect(() => {
    audio.setMuted(settings.muted)
    audio.setVolume(settings.volume)
  }, [settings.muted, settings.volume])

  const setMuted = useCallback((muted: boolean) => {
    setSettings((s) => ({ ...s, muted }))
    saveSettings({ muted })
  }, [])

  const toggleMuted = useCallback(() => {
    setSettings((s) => {
      const next = { ...s, muted: !s.muted }
      saveSettings({ muted: next.muted })
      return next
    })
  }, [])

  const setVolume = useCallback((volume: number) => {
    const v = Math.max(0, Math.min(1, volume))
    setSettings((s) => ({ ...s, volume: v }))
    saveSettings({ volume: v })
  }, [])

  return {
    muted: settings.muted,
    volume: settings.volume,
    setMuted,
    toggleMuted,
    setVolume,
  }
}

/**
 * 业务组件的最小 API。返回稳定引用的 `play(id)`。
 * 由于 AudioSystem 是单例，这个 hook 不持有任何 state，`useCallback([])` 即可。
 */
export function usePlaySfx(): (id: SfxId) => void {
  return useCallback((id: SfxId) => audio.play(id), [])
}

/**
 * BGM 控制 hook。参数：
 * - `active`：true → 起 BGM，false → 停；
 * - `ducked`：true → 压低音量（结算 / 暂停期间用）；false → 恢复。
 *
 * 内部对 active/ducked 都做去重比较，避免每帧调用引起的空转（虽然实际上
 * setTargetAtTime 本身也幂等，但少一次跨 realm 调用总归更安静）。
 */
export function useBgm(active: boolean, ducked = false): void {
  const activeRef = useRef(false)
  const duckedRef = useRef(false)

  useEffect(() => {
    if (active && !activeRef.current) {
      audio.startBgm()
      activeRef.current = true
    } else if (!active && activeRef.current) {
      audio.stopBgm()
      activeRef.current = false
    }
  }, [active])

  useEffect(() => {
    if (ducked !== duckedRef.current) {
      audio.duckBgm(ducked)
      duckedRef.current = ducked
    }
  }, [ducked])

  useEffect(
    () => () => {
      // 组件卸载时保底停 BGM（例如从 /play 直接跳 /leaderboard）。
      if (activeRef.current) {
        audio.stopBgm()
        activeRef.current = false
      }
    },
    [],
  )
}
