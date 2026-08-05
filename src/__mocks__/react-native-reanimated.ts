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
// Real `useAnimatedStyle`/`useAnimatedProps` recompute reactively whenever a SharedValue read
// inside `factory` mutates, independent of React's own render cycle — the exact mechanism this
// package's whole 2026-08-03 bug class was about (a dependency array missing one of those
// SharedValues silently freezes it on web). Rather than reproduce that reactivity model (a
// SharedValue/subscriber pub-sub only worth building if a test needs to assert "did NOT
// recompute"), this mock just calls `factory` fresh on every render — deliberately ignoring the
// deps array entirely. That means a test only has to mutate a `.value` and trigger any re-render
// (e.g. `rerender()`, or a prop/state change) to see the up-to-date computed style; it will not
// by itself catch a missing dependency (that's what the `react-hooks/exhaustive-deps`
// `additionalHooks` lint rule is for) — it catches wrong *logic* inside the factory.
export const useAnimatedStyle = (factory: () => object, _deps?: unknown[]) => factory()
export const useAnimatedProps = (factory: () => object, _deps?: unknown[]) => factory()
export const useAnimatedScrollHandler = (_handler: unknown) => jest.fn()
// Same "always fresh" simplification as useAnimatedStyle above, adapted to useAnimatedReaction's
// three-argument (prepare, reaction, deps) shape: call `prepare` and invoke `reaction` with the
// previous call's result every time this hook itself is invoked (i.e. on every render), letting
// the real component's own `curr !== prev` guard (present at every call site in this package)
// decide whether to act. `prev` is `null` on the very first call, matching real reanimated.
export const useAnimatedReaction = <T,>(prepare: () => T, reaction: (curr: T, prev: T | null) => void, _deps?: unknown[]) => {
  const prevRef = React.useRef<{ value: T } | null>(null)
  const curr = prepare()
  reaction(curr, prevRef.current ? prevRef.current.value : null)
  prevRef.current = { value: curr }
}
export const useDerivedValue = (factory: () => unknown) => ({ value: factory() })
export const withTiming = (value: number) => value
export const withSpring = (value: number) => value

// Real functional implementations, not stubs — now that useAnimatedStyle/useAnimatedProps above
// actually call their factories, every helper those factories call (interpolate/interpolateColor/
// Extrapolation in this package's PullSearch and HorizontalDots) has to actually work, not just
// exist, or the factory throws the moment a test renders that component.
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' } as const

const findSegment = (value: number, inputRange: number[]) => {
  let i = 0
  while (i < inputRange.length - 2 && value > inputRange[i + 1]) i++
  return i
}

export const interpolate = (value: number, inputRange: number[], outputRange: number[], extrapolate?: unknown) => {
  const i = findSegment(value, inputRange)
  const inStart = inputRange[i]
  const inEnd = inputRange[i + 1]
  const outStart = outputRange[i]
  const outEnd = outputRange[i + 1]
  const t = inEnd === inStart ? 0 : (value - inStart) / (inEnd - inStart)
  const result = outStart + t * (outEnd - outStart)
  const clamp = extrapolate === Extrapolation.CLAMP || (typeof extrapolate === 'object' && extrapolate !== null && ('extrapolateLeft' in extrapolate || 'extrapolateRight' in extrapolate))
  if (!clamp) return result
  const lo = Math.min(outStart, outEnd)
  const hi = Math.max(outStart, outEnd)
  return Math.min(hi, Math.max(lo, result))
}

const parseColor = (color: string) => {
  const hex = color.replace('#', '')
  if (hex.length === 3) {
    const [r, g, b] = hex.split('').map((c) => parseInt(c + c, 16))
    return { b, g, r }
  }
  if (hex.length >= 6) return { b: parseInt(hex.slice(4, 6), 16), g: parseInt(hex.slice(2, 4), 16), r: parseInt(hex.slice(0, 2), 16) }
  return { b: 0, g: 0, r: 0 }
}

export const interpolateColor = (value: number, inputRange: number[], outputColorRange: string[]) => {
  const i = findSegment(value, inputRange)
  const span = inputRange[i + 1] - inputRange[i]
  const t = Math.min(1, Math.max(0, span === 0 ? 0 : (value - inputRange[i]) / span))
  const c1 = parseColor(outputColorRange[i])
  const c2 = parseColor(outputColorRange[i + 1])
  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}
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
// `View` is spy-wrapped (matching Surface/ProgressBar/Chip in the react-native-paper mock) so a
// test can pull `onLayout` off the last render's props and invoke it manually — e.g. PullSearch's
// barHeight only ever becomes non-zero through a real onLayout call, which nothing fires on its
// own in this mocked environment.
const Animated = {
  View: jest.fn(stub),
  Text: stub,
  ScrollView: stub,
  FlatList: stub,
  createAnimatedComponent
}

export { Animated }
export default Animated
