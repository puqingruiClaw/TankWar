import { useEffect, useRef } from 'react'

import { InputSystem, type InputSystemOptions } from '../game/systems/InputSystem'

export function useKeyboard(options: InputSystemOptions = {}): InputSystem {
  const inputRef = useRef<InputSystem | null>(null)
  if (inputRef.current === null) {
    inputRef.current = new InputSystem(options)
  }
  const input = inputRef.current

  useEffect(() => {
    input.attach()
    return () => {
      input.detach()
    }
  }, [input])

  return input
}
