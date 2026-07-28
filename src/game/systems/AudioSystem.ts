/**
 * AudioSystem —— T-22 引入。基于 Web Audio API 的 8-bit 音效引擎（单例）。
 *
 * 设计目标：
 * 1. **零素材**：所有音色运行时合成为 `AudioBuffer` 并缓存；产物 gzip 一字节
 *    不涨，符合 [Sprint 4 验收标准](../../../.trae/documents/schedule-and-roles.md#L85)。
 * 2. **零依赖**：仅使用浏览器原生 Web Audio API，与
 *    [technical-architecture 2.3](../../../.trae/documents/technical-architecture.md#L31)
 *    的技术选型一致。
 * 3. **AudioContext 惰性初始化**：Chrome/Safari 的 autoplay policy 要求 context
 *    必须在"用户手势"栈内创建/resume。因此本模块**只有**在 [play](#L200-L226)
 *    首次被调用时（此时肯定处在 keydown 回调栈）才建 context。
 * 4. **帧尾 flush**：符合 [technical-architecture 5.1](../../../.trae/documents/technical-architecture.md#L107)
 *    定义的 `AudioSystem.flush()` 时序 —— 每帧最多每种事件响一次，避免同一 tick
 *    多次 onExplosion 造成的"噼里啪啦"叠音。
 * 5. **静音是"跳过 output"而非"停 context"**：静音时 [play](#L200-L226) 仍会
 *    走完队列合并逻辑，只是不调用 `connect(destination)`；这样切换 muted 时
 *    不会有"context 半死不活"的边界状态。
 *
 * 音色统一使用 **方波 / 三角波 / 白噪声** 三种基元 —— 这是红白机 APU 的核心
 * 三大声道（PSG + noise），最接近"8-bit 感觉"。
 */

export type SfxId =
  | 'player-fire'
  | 'enemy-fire'
  | 'explosion-bullet'
  | 'explosion-tank'
  | 'powerup-appear'
  | 'powerup-pickup'
  | 'life-lost'
  | 'stage-clear'
  | 'game-over'
  | 'game-complete'
  | 'menu-move'
  | 'menu-confirm'

// ─── 波形合成基元 ────────────────────────────────────────────────────────

type WaveShape = 'square' | 'triangle' | 'noise'

interface ToneSpec {
  /** 波形。noise 忽略 freq 用白噪声。 */
  shape: WaveShape
  /** 起始频率（Hz）。 */
  freq: number
  /** 结束频率（Hz）。用于线性扫频；等于 freq 表示定频。 */
  freqEnd?: number
  /** 持续时间（秒）。 */
  duration: number
  /** 峰值音量（0~1）。 */
  gain: number
  /** 起始时间偏移（秒），用于把多个 tone 串成音序。 */
  offset?: number
}

/**
 * 合成单条 tone 到目标 buffer 的 [start, start+duration) 区间。
 * 采用简单的 ADSR：attack 3ms → sustain → 30ms release，够"啵"的干脆。
 */
function synthesizeTone(buffer: Float32Array, sampleRate: number, spec: ToneSpec): void {
  const offsetSec = spec.offset ?? 0
  const startSample = Math.floor(offsetSec * sampleRate)
  const endSample = Math.min(buffer.length, startSample + Math.floor(spec.duration * sampleRate))
  const attackSamples = Math.min(Math.floor(0.003 * sampleRate), endSample - startSample)
  const releaseSamples = Math.min(Math.floor(0.03 * sampleRate), endSample - startSample)
  const sustainEnd = endSample - releaseSamples

  const freqStart = spec.freq
  const freqEnd = spec.freqEnd ?? spec.freq
  const totalSamples = endSample - startSample

  let phase = 0
  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / Math.max(1, totalSamples - 1)
    // 线性扫频；对 square/triangle 采用"相位累加 + 瞬时频率"以避免频率跳变时爆音。
    const freq = freqStart + (freqEnd - freqStart) * t

    let s: number
    if (spec.shape === 'noise') {
      s = Math.random() * 2 - 1
    } else {
      phase += (freq * 2 * Math.PI) / sampleRate
      if (spec.shape === 'square') {
        s = Math.sin(phase) >= 0 ? 1 : -1
      } else {
        // triangle：把 sin 变成三角波
        const sin = Math.sin(phase)
        s = (2 / Math.PI) * Math.asin(sin)
      }
    }

    // ADSR envelope
    let env = 1
    if (i - startSample < attackSamples) {
      env = (i - startSample) / attackSamples
    } else if (i >= sustainEnd) {
      env = Math.max(0, 1 - (i - sustainEnd) / Math.max(1, releaseSamples))
    }

    // 叠加（不覆盖）—— 支持多 tone 时间上重叠（如 chord）。
    buffer[i] += s * spec.gain * env
  }
}

/** 归一化，避免多 tone 叠加溢出。 */
function normalize(buffer: Float32Array, targetPeak = 0.9): void {
  let peak = 0
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i])
    if (abs > peak) peak = abs
  }
  if (peak <= targetPeak || peak === 0) return
  const scale = targetPeak / peak
  for (let i = 0; i < buffer.length; i++) buffer[i] *= scale
}

/** 从 tone 列表合成一段 buffer（内部工具，被各 sfx 工厂调用）。 */
function makeBuffer(ctx: AudioContext, totalDuration: number, tones: ToneSpec[]): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(totalDuration * ctx.sampleRate), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (const tone of tones) synthesizeTone(data, ctx.sampleRate, tone)
  normalize(data)
  return buffer
}

// ─── 各音效工厂 ────────────────────────────────────────────────────────

/**
 * 各 sfx 的合成参数表。抽出成表驱动，方便调音时集中修改。
 * 每个 factory 都返回"总时长 + tone 序列"。
 */
type SfxFactory = (ctx: AudioContext) => AudioBuffer

const SFX_FACTORIES: Record<SfxId, SfxFactory> = {
  'player-fire': (ctx) =>
    makeBuffer(ctx, 0.08, [
      { shape: 'square', freq: 660, freqEnd: 330, duration: 0.06, gain: 0.3 },
    ]),
  'enemy-fire': (ctx) =>
    makeBuffer(ctx, 0.08, [
      { shape: 'square', freq: 220, freqEnd: 110, duration: 0.06, gain: 0.25 },
    ]),
  'explosion-bullet': (ctx) =>
    makeBuffer(ctx, 0.14, [{ shape: 'noise', freq: 0, duration: 0.12, gain: 0.35 }]),
  'explosion-tank': (ctx) =>
    makeBuffer(ctx, 0.34, [
      { shape: 'noise', freq: 0, duration: 0.32, gain: 0.45 },
      { shape: 'square', freq: 110, freqEnd: 40, duration: 0.32, gain: 0.25 },
    ]),
  'powerup-appear': (ctx) =>
    makeBuffer(ctx, 0.4, [
      { shape: 'triangle', freq: 880, duration: 0.08, gain: 0.3, offset: 0 },
      { shape: 'triangle', freq: 1320, duration: 0.08, gain: 0.3, offset: 0.1 },
      { shape: 'triangle', freq: 880, duration: 0.08, gain: 0.3, offset: 0.2 },
      { shape: 'triangle', freq: 1320, duration: 0.08, gain: 0.3, offset: 0.3 },
    ]),
  'powerup-pickup': (ctx) =>
    makeBuffer(ctx, 0.36, [
      { shape: 'triangle', freq: 660, duration: 0.1, gain: 0.35, offset: 0 },
      { shape: 'triangle', freq: 990, duration: 0.1, gain: 0.35, offset: 0.1 },
      { shape: 'triangle', freq: 1320, duration: 0.14, gain: 0.4, offset: 0.2 },
    ]),
  'life-lost': (ctx) =>
    makeBuffer(ctx, 0.42, [{ shape: 'square', freq: 220, freqEnd: 55, duration: 0.4, gain: 0.35 }]),
  'stage-clear': (ctx) =>
    makeBuffer(ctx, 0.55, [
      { shape: 'square', freq: 523, duration: 0.15, gain: 0.35, offset: 0 },
      { shape: 'square', freq: 659, duration: 0.15, gain: 0.35, offset: 0.15 },
      { shape: 'square', freq: 784, duration: 0.22, gain: 0.4, offset: 0.3 },
    ]),
  'game-over': (ctx) =>
    makeBuffer(ctx, 0.7, [
      { shape: 'square', freq: 392, duration: 0.2, gain: 0.35, offset: 0 },
      { shape: 'square', freq: 330, duration: 0.2, gain: 0.35, offset: 0.2 },
      { shape: 'square', freq: 262, duration: 0.28, gain: 0.4, offset: 0.4 },
    ]),
  'game-complete': (ctx) =>
    makeBuffer(ctx, 0.9, [
      { shape: 'square', freq: 523, duration: 0.14, gain: 0.35, offset: 0 },
      { shape: 'square', freq: 659, duration: 0.14, gain: 0.35, offset: 0.14 },
      { shape: 'square', freq: 784, duration: 0.14, gain: 0.35, offset: 0.28 },
      { shape: 'square', freq: 988, duration: 0.14, gain: 0.35, offset: 0.42 },
      { shape: 'square', freq: 1319, duration: 0.28, gain: 0.45, offset: 0.56 },
    ]),
  'menu-move': (ctx) =>
    makeBuffer(ctx, 0.04, [{ shape: 'square', freq: 440, duration: 0.02, gain: 0.2 }]),
  'menu-confirm': (ctx) =>
    makeBuffer(ctx, 0.06, [
      { shape: 'square', freq: 660, freqEnd: 1320, duration: 0.05, gain: 0.3 },
    ]),
}

// ─── BGM ────────────────────────────────────────────────────────────────

/**
 * 生成 8 秒可循环 BGM：低音三角波 pad + 中音方波音序。
 * 循环时相位不必对齐 —— triangle 在段首刚好过零点，衔接不会爆音。
 */
function makeBgmBuffer(ctx: AudioContext): AudioBuffer {
  const duration = 8
  const buffer = ctx.createBuffer(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate)
  const data = buffer.getChannelData(0)

  // 低音 pad：A2 长音 4s + F2 长音 4s
  synthesizeTone(data, ctx.sampleRate, {
    shape: 'triangle',
    freq: 110,
    duration: 4,
    gain: 0.15,
    offset: 0,
  })
  synthesizeTone(data, ctx.sampleRate, {
    shape: 'triangle',
    freq: 87,
    duration: 4,
    gain: 0.15,
    offset: 4,
  })

  // 中音音序：8 个 0.5s 音符（A3 - C4 - E4 - C4 循环变奏）
  const melody = [220, 262, 330, 262, 196, 233, 294, 233]
  for (let i = 0; i < melody.length; i++) {
    synthesizeTone(data, ctx.sampleRate, {
      shape: 'square',
      freq: melody[i],
      duration: 0.42,
      gain: 0.1,
      offset: i * 1,
    })
  }
  normalize(data, 0.7)
  return buffer
}

// ─── AudioSystem ────────────────────────────────────────────────────────

class AudioSystemImpl {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private bgmSource: AudioBufferSourceNode | null = null

  private muted = false
  private volume = 0.6
  private bgmVolume = 0.35
  private bgmDucked = false

  private bufferCache = new Map<SfxId, AudioBuffer>()
  private bgmBuffer: AudioBuffer | null = null

  /**
   * 每帧的"待播队列"—— 同一 tick 内多次 play 相同 id 只响一次，避免
   * onExplosion 连发时叠成噪音。真正在 [flush](#L296-L315) 里统一 output。
   */
  private queue = new Set<SfxId>()

  /** 惰性建 context。必须在用户手势栈内调用（否则 Chrome 会拒绝 output）。 */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    if (typeof window === 'undefined') return null
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      this.ctx = new Ctor()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)

      this.bgmGain = this.ctx.createGain()
      this.bgmGain.gain.value = this.bgmVolume
      this.bgmGain.connect(this.masterGain)
    } catch {
      // 部分环境（如 SSR / 极端隐私浏览器）建 context 会抛，回退到"无声"。
      this.ctx = null
    }
    return this.ctx
  }

  private getBuffer(id: SfxId): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    let buf = this.bufferCache.get(id)
    if (!buf) {
      buf = SFX_FACTORIES[id](ctx)
      this.bufferCache.set(id, buf)
    }
    return buf
  }

  /**
   * 请求播放。**同一 tick 内相同 id 会去重**——真正 output 发生在 flush。
   * 但如果 flush 还没被调度（例如菜单页），立即 output 也没问题：这里选择
   * "立即出声"（menu 场景需要即时反馈），并在 flush 时清空队列以防副作用。
   */
  play(id: SfxId): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    if (this.queue.has(id)) return
    this.queue.add(id)

    if (this.muted) return
    if (ctx.state === 'suspended') {
      // resume 是 promise，但我们不 await —— 首次点击时短暂延迟不影响体验。
      void ctx.resume().catch(() => {})
    }
    const buffer = this.getBuffer(id)
    if (!buffer || !this.masterGain) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.masterGain)
    src.start()
  }

  /**
   * 帧尾清队列。GameCanvas 会在每次 onUpdate 结束时调用一次；菜单页不调用
   * 也无所谓 —— 队列大小最多 12，内存开销可忽略。
   */
  flush(): void {
    this.queue.clear()
  }

  // ─── BGM 控制 ───────────────────────────────────────────────────────────

  startBgm(): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.bgmGain) return
    if (this.bgmSource) return
    if (!this.bgmBuffer) this.bgmBuffer = makeBgmBuffer(ctx)
    const src = ctx.createBufferSource()
    src.buffer = this.bgmBuffer
    src.loop = true
    src.connect(this.bgmGain)
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    src.start()
    this.bgmSource = src
  }

  stopBgm(): void {
    if (!this.bgmSource) return
    try {
      this.bgmSource.stop()
    } catch {
      // 已停止则忽略。
    }
    this.bgmSource.disconnect()
    this.bgmSource = null
  }

  /** BGM 压低：pause / stage-clear / game-over 场景用，让结算音效突出。 */
  duckBgm(ducked: boolean): void {
    this.bgmDucked = ducked
    if (!this.bgmGain || !this.ctx) return
    const target = ducked ? this.bgmVolume * 0.15 : this.bgmVolume
    this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05)
  }

  // ─── 全局音量 / 静音 ────────────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this.muted = muted
    if (!this.masterGain || !this.ctx) return
    this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02)
  }

  isMuted(): boolean {
    return this.muted
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.muted || !this.masterGain || !this.ctx) return
    this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02)
  }

  getVolume(): number {
    return this.volume
  }

  /** 供测试或热重载重置使用；生产运行时不必调用。 */
  destroy(): void {
    this.stopBgm()
    if (this.ctx) void this.ctx.close().catch(() => {})
    this.ctx = null
    this.masterGain = null
    this.bgmGain = null
    this.bufferCache.clear()
    this.bgmBuffer = null
    this.queue.clear()
    this.bgmDucked = false
  }
}

/**
 * 全局单例。整个 app 只需要一份 AudioContext；跨路由/组件卸载 context
 * 仍存活，避免反复建/销毁。
 */
export const audio = new AudioSystemImpl()
