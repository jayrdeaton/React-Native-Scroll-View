import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

// Real Reanimated shared values persist their `.value` across re-renders (like useRef) — the
// `init` argument is only honored on the first call. A naive `{ value: init }` per render would
// silently discard mutations made during a previous render every time the owning component re-renders.
export const useSharedValue = <T,>(init: T) => {
  const ref = React.useRef<{ value: T } | null>(null)
  if (!ref.current) ref.current = { value: init }
  return ref.current
}

// Reanimated's useAnimatedRef returns a stable callable that also exposes `.current`, so
// consumers can either pass it directly as a `ref` prop or read/assign `.current` imperatively.
export const useAnimatedRef = <T,>() => {
  const holder = React.useRef<((node: T | null) => void) & { current: T | null }>(undefined as unknown as ((node: T | null) => void) & { current: T | null })
  if (!holder.current) {
    let current: T | null = null
    const fn = ((node: T | null) => {
      current = node
    }) as ((node: T | null) => void) & { current: T | null }
    Object.defineProperty(fn, 'current', {
      get: () => current,
      set: (node: T | null) => {
        current = node
      }
    })
    holder.current = fn
  }
  return holder.current
}
export const useAnimatedStyle = (_factory: () => object) => ({})
export const useAnimatedProps = (_factory: () => object) => ({})
export const useAnimatedScrollHandler = (_handler: unknown) => jest.fn()
export const useAnimatedReaction = jest.fn()
export const useDerivedValue = (factory: () => unknown) => ({ value: factory() })
export const withTiming = (value: number) => value
export const withSpring = (value: number) => value
export const runOnJS =
  <T extends (...args: unknown[]) => unknown>(fn: T) =>
  (...args: Parameters<T>) =>
    fn(...args)
export const runOnUI =
  <T extends (...args: unknown[]) => unknown>(fn: T) =>
  (...args: Parameters<T>) =>
    fn(...args)

export const createAnimatedComponent = (C: React.ComponentType) => C

// The default export IS the Animated namespace — `import Animated from 'reanimated'` → Animated.View
const Animated = {
  View: stub,
  Text: stub,
  ScrollView: stub,
  FlatList: stub,
  createAnimatedComponent
}

export { Animated }
export default Animated
