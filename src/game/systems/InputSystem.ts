import { ALT_KEYMAP, DEFAULT_KEYMAP, INPUT_GAME_KEYS } from '../constants'
import type { Direction, InputAction, InputIntent, KeyBinding } from '../types'

const DIRECTION_ACTIONS: readonly Extract<InputAction, Direction>[] = [
  'up',
  'down',
  'left',
  'right',
]

export interface InputSystemOptions {
  primary?: KeyBinding
  alternate?: KeyBinding | null
  target?: Window | HTMLElement
  preventDefault?: boolean
}

export class InputSystem {
  private primary: KeyBinding
  private alternate: KeyBinding | null
  private readonly target: Window | HTMLElement
  private readonly preventDefault: boolean

  private readonly held = new Set<string>()
  private readonly dirStack: Direction[] = []

  private firePressed = false
  private firePressedEdge = false
  private pauseEdge = false

  private attached = false

  constructor(options: InputSystemOptions = {}) {
    this.primary = options.primary ?? { ...DEFAULT_KEYMAP }
    this.alternate = options.alternate === null ? null : (options.alternate ?? { ...ALT_KEYMAP })
    this.target = options.target ?? window
    this.preventDefault = options.preventDefault ?? true
  }

  attach(): void {
    if (this.attached) return
    this.target.addEventListener('keydown', this.onKeyDown as EventListener)
    this.target.addEventListener('keyup', this.onKeyUp as EventListener)
    this.target.addEventListener('blur', this.onBlur as EventListener)
    this.attached = true
  }

  detach(): void {
    if (!this.attached) return
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener)
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener)
    this.target.removeEventListener('blur', this.onBlur as EventListener)
    this.attached = false
    this.reset()
  }

  setBindings(primary: KeyBinding, alternate: KeyBinding | null = this.alternate): void {
    this.primary = primary
    this.alternate = alternate
    this.reset()
  }

  reset(): void {
    this.held.clear()
    this.dirStack.length = 0
    this.firePressed = false
    this.firePressedEdge = false
    this.pauseEdge = false
  }

  getIntent(): InputIntent {
    const top = this.dirStack.length > 0 ? this.dirStack[this.dirStack.length - 1] : null
    return {
      dir: top,
      fire: this.firePressed,
      pausePressed: this.pauseEdge,
    }
  }

  consumeEdges(): { fireEdge: boolean; pauseEdge: boolean } {
    const fireEdge = this.firePressedEdge
    const pauseEdge = this.pauseEdge
    this.firePressedEdge = false
    this.pauseEdge = false
    return { fireEdge, pauseEdge }
  }

  consumeFireEdge(): boolean {
    const edge = this.firePressedEdge
    this.firePressedEdge = false
    return edge
  }

  consumePauseEdge(): boolean {
    const edge = this.pauseEdge
    this.pauseEdge = false
    return edge
  }

  isDown(action: InputAction): boolean {
    return (
      this.held.has(this.primary[action]) ||
      (!!this.alternate && this.held.has(this.alternate[action]))
    )
  }

  private resolveAction(code: string): InputAction | null {
    for (const action of ['up', 'down', 'left', 'right', 'fire', 'pause'] as InputAction[]) {
      if (this.primary[action] === code) return action
      if (this.alternate && this.alternate[action] === code) return action
    }
    return null
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const code = event.code
    const action = this.resolveAction(code)
    if (!action) return
    if (this.preventDefault && INPUT_GAME_KEYS.includes(code)) event.preventDefault()
    if (event.repeat) return
    if (this.held.has(code)) return
    this.held.add(code)

    if (isDirectionAction(action)) {
      const idx = this.dirStack.indexOf(action)
      if (idx >= 0) this.dirStack.splice(idx, 1)
      this.dirStack.push(action)
    } else if (action === 'fire') {
      this.firePressed = true
      this.firePressedEdge = true
    } else if (action === 'pause') {
      this.pauseEdge = true
    }
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    const code = event.code
    const action = this.resolveAction(code)
    if (!action) return
    if (this.preventDefault && INPUT_GAME_KEYS.includes(code)) event.preventDefault()
    if (!this.held.delete(code)) return

    if (isDirectionAction(action)) {
      const idx = this.dirStack.indexOf(action)
      if (idx >= 0) this.dirStack.splice(idx, 1)
    } else if (action === 'fire') {
      if (!this.isDown('fire')) this.firePressed = false
    }
  }

  private onBlur = (): void => {
    this.reset()
  }
}

function isDirectionAction(action: InputAction): action is Extract<InputAction, Direction> {
  return (DIRECTION_ACTIONS as readonly InputAction[]).includes(action)
}
