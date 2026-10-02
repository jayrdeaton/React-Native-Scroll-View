import { useContext, useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { type AnimatedStyle, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { ScrollViewChromeContext } from './ScrollViewChromeContext'

const noop = () => {}

// Animated style for a persistent bar hosted by ScrollViewChromeProvider: translates it by the same
// shared offset the focused screen's footer uses, so the two hide and reveal together. Outside any
// host it is a permanent zero translate, so a bar can call this unconditionally.
//
// The return type is spelled out with reanimated's PUBLIC AnimatedStyle rather than left inferred:
// useAnimatedStyle's own inferred type (AnimatedStyleHandle) lives in a private reanimated deep path
// that the built .d.ts would otherwise import from, which only resolves for the exact reanimated
// file layout this was built against.
export const useScrollViewChromeStyle = (): StyleProp<AnimatedStyle<StyleProp<ViewStyle>>> => {
  const chrome = useContext(ScrollViewChromeContext)
  const fallback = useSharedValue(0)
  const offset = chrome?.offset ?? fallback
  return useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }), [offset])
}

// Holds the bar fully revealed (and stops scroll from hiding it) while `active` is true. Pins are
// counted, so two independent pinners can't release each other. Inert outside a host.
export const useScrollViewChromePin = (active: boolean) => {
  const chrome = useContext(ScrollViewChromeContext)
  const addPin = chrome?.addPin
  const removePin = chrome?.removePin
  useEffect(() => {
    if (!active || !addPin || !removePin) return undefined
    addPin()
    return removePin
  }, [active, addPin, removePin])
}

// Returns a function that animates the bar back to fully revealed. Inert outside a host.
export const useScrollViewChromeReveal = () => {
  const chrome = useContext(ScrollViewChromeContext)
  return chrome?.reveal ?? noop
}
