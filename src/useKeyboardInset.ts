import { useState } from 'react'
import { Platform } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { runOnJS } from 'react-native-reanimated'

const useKeyboardInsetNative = () => {
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

const useKeyboardInsetWeb = () => 0

// react-native-keyboard-controller has no web implementation — its handler hook must never be
// called there. Platform is constant for the life of the bundle, so this select is hook-safe.
export const useKeyboardInset = Platform.OS === 'web' ? useKeyboardInsetWeb : useKeyboardInsetNative
