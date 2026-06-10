import { useState } from 'react'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { runOnJS } from 'react-native-reanimated'

export const useKeyboardInset = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet'
        runOnJS(setKeyboardHeight)(e.height)
      },
      onEnd: (e) => {
        'worklet'
        runOnJS(setKeyboardHeight)(e.height)
      }
    },
    []
  )
  return keyboardHeight
}
