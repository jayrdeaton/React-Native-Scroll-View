import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const useSharedValue = (init: number) => ({ value: init })
export const useAnimatedStyle = (_factory: () => object) => ({})
export const useAnimatedScrollHandler = (_handler: unknown) => jest.fn()
export const useAnimatedReaction = jest.fn()
export const useDerivedValue = (factory: () => unknown) => ({ value: factory() })
export const withTiming = (value: number) => value
export const withSpring = (value: number) => value
export const runOnJS =
  <T extends (...args: unknown[]) => unknown>(fn: T) =>
  (...args: Parameters<T>) =>
    fn(...args)

// The default export IS the Animated namespace — `import Animated from 'reanimated'` → Animated.View
const Animated = {
  View: stub,
  Text: stub,
  ScrollView: stub,
  FlatList: stub,
  createAnimatedComponent: (C: React.ComponentType) => C
}

export { Animated }
export default Animated
