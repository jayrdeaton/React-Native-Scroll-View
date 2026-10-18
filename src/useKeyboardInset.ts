import { callWorkletCallback, useWorkletCallback } from '@rific/core'
import { useState } from 'react'
import { Platform } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { scheduleOnRN } from 'react-native-worklets'

const useKeyboardInsetNative = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const keyboardHeightKey = useWorkletCallback(setKeyboardHeight)
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet'
        scheduleOnRN(callWorkletCallback, keyboardHeightKey, e.height)
      },
      onEnd: (e) => {
        'worklet'
        scheduleOnRN(callWorkletCallback, keyboardHeightKey, e.height)
      }
    },
    []
  )
  return keyboardHeight
}

const useKeyboardInsetWeb = () => 0

// react-native-keyboard-controller has no web implementation - its handler hook must never be
// called there. Platform is constant for the life of the bundle, so this select is hook-safe.
export const useKeyboardInset = Platform.OS === 'web' ? useKeyboardInsetWeb : useKeyboardInsetNative
