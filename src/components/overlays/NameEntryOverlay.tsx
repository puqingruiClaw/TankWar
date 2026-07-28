import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * NameEntryOverlay —— T-21 引入。破纪录时呼出的 3 字母昵称录入面板。
 *
 * 交互（键盘唯一，符合 8-bit 街机口径）：
 * - ↑ / ↓：当前格字母 +1 / -1（A-Z 循环）
 * - ← / →：光标左右切格
 * - Enter：提交当前 3 字母
 * - Esc：直接以当前值提交（放弃精调）
 *
 * PRD §2.3 —— 破纪录时要求"输入 3 字母昵称"。此组件是唯一的书写入口，与
 * [leaderboard.sanitizeName](file:///Users/puqingrui/workspace/Projects/TankWar/src/lib/leaderboard.ts#L45-L57) 双保险，把非法字符拒之于外。
 *
 * 设计选择：使用 window keydown 而不是 <input> 元素——避免与 GameCanvas
 * 的键盘输入互抢焦点，且免去了移动端弹出软键盘的问题；同时用
 * `event.preventDefault + stopPropagation` 阻止事件被 GameCanvas 消费。
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SLOT_COUNT = 3

export interface NameEntryOverlayProps {
  score: number
  stageId: number
  onSubmit: (name: string) => void
}

export default function NameEntryOverlay({ score, stageId, onSubmit }: NameEntryOverlayProps) {
  const [letters, setLetters] = useState<number[]>(() => Array<number>(SLOT_COUNT).fill(0))
  const [cursor, setCursor] = useState(0)
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  const submit = useCallback((next: number[]) => {
    const name = next.map((idx) => ALPHABET[idx]).join('')
    onSubmitRef.current(name)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'Enter' ||
        key === 'Escape'
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (key === 'ArrowUp') {
        setLetters((prev) => {
          const next = [...prev]
          next[cursor] = (next[cursor] + 1) % ALPHABET.length
          return next
        })
      } else if (key === 'ArrowDown') {
        setLetters((prev) => {
          const next = [...prev]
          next[cursor] = (next[cursor] - 1 + ALPHABET.length) % ALPHABET.length
          return next
        })
      } else if (key === 'ArrowLeft') {
        setCursor((c) => (c - 1 + SLOT_COUNT) % SLOT_COUNT)
      } else if (key === 'ArrowRight') {
        setCursor((c) => (c + 1) % SLOT_COUNT)
      } else if (key === 'Enter' || key === 'Escape') {
        setLetters((prev) => {
          submit(prev)
          return prev
        })
      }
    }
    // 用 capture=true 抢在 GameCanvas 的 window keydown 之前处理，避免"↑"意外让坦克前进。
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [cursor, submit])

  return (
    <div
      aria-label="Enter your name"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 font-pixel text-white"
    >
      <p className="text-pixel-lg text-hud-accent">NEW RECORD!</p>
      <p className="mt-2 text-pixel-sm text-outline">
        SCORE <span className="text-hud-accent">{score.toString().padStart(6, '0')}</span> · STAGE{' '}
        <span className="text-hud-accent">{stageId.toString().padStart(2, '0')}</span>
      </p>
      <p className="mt-4 text-pixel-sm text-outline">ENTER YOUR NAME</p>
      <div className="mt-3 flex gap-3">
        {letters.map((idx, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-pixel-xs text-outline">{i === cursor ? '▲' : ' '}</span>
            <span
              className={
                i === cursor
                  ? 'animate-blink border-b-2 border-hud-accent px-2 text-pixel-2xl text-hud-accent'
                  : 'border-b-2 border-outline px-2 text-pixel-2xl text-white'
              }
            >
              {ALPHABET[idx]}
            </span>
            <span className="text-pixel-xs text-outline">{i === cursor ? '▼' : ' '}</span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-pixel-xs text-outline">↑↓ CHANGE · ←→ MOVE · ENTER SUBMIT</p>
    </div>
  )
}
