import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useSharedValue, withTiming } from 'react-native-reanimated'

import { ScrollViewChromeContext, ScrollViewChromeHostContext } from './ScrollViewChromeContext'

const REVEAL_DURATION = 200

const alwaysActive = () => true

export type ScrollViewChromeProviderProps = {
  children: ReactNode
  // Height of a persistent bottom bar's resting box (its row + safe-area inset), i.e. how far up from
  // the screen bottom a hosted ScrollViewFooter has to sit to clear it. Passed in as a plain number
  // rather than reported back by the bar, so every hosted screen has the right geometry on its very
  // first render instead of one commit later.
  footprint: number
  // How far the bar pokes ABOVE its resting box (a FAB that dips out of it, say). Hosted footers pad
  // their bottom by this instead of the safe-area inset, and the hide distance covers it.
  overhang?: number
  // Hosted footers reveal on a short scroll-up instead of only near the top. A bar that hides on
  // scroll has to be reachable from anywhere in a list, so this is on by default — and there is no
  // "hide but only reveal near the top" mode: `snapBack={false}` turns hiding off entirely, leaving
  // the bar and hosted footers permanently revealed.
  snapBack?: boolean
  // A hook (not a plain function) returning whether the calling screen is the focused one, e.g.
  // react-navigation's useIsFocused. Injected rather than imported so this package carries no
  // navigation dependency. It has to be a stable reference: it is called as a hook on every render.
  useIsActive?: () => boolean
}

// Mounted once above a navigator (a Tabs layout). Every ScrollViewProvider below it that is focused
// claims it, and while it does, that screen's scroll handlers drive one shared `offset` that the
// screen's own ScrollViewFooter AND the persistent bar both translate by — a single value read by
// both, so the two move as one rigid stack instead of being two animations that have to be kept in
// step.
export const ScrollViewChromeProvider = ({ children, footprint, overhang = 0, snapBack = true, useIsActive = alwaysActive }: ScrollViewChromeProviderProps) => {
  const offset = useSharedValue(0)
  const [claims, setClaims] = useState<string[]>([])
  const [pins, setPins] = useState(0)
  const activeId = claims.length > 0 ? claims[claims.length - 1] : null
  const pinned = pins > 0
  const claim = useCallback((id: string) => setClaims((current) => [...current.filter((c) => c !== id), id]), [])
  const release = useCallback((id: string) => setClaims((current) => current.filter((c) => c !== id)), [])
  const addPin = useCallback(() => setPins((current) => current + 1), [])
  const removePin = useCallback(() => setPins((current) => Math.max(0, current - 1)), [])
  const reveal = useCallback(() => {
    offset.value = withTiming(0, { duration: REVEAL_DURATION })
  }, [offset])
  // offset is per-host but the scroll state that produced it is per-screen, and nothing else ever
  // zeroes it except a scroll event landing at the top of a list. Without this, popping back to a
  // screen that was hidden when it lost focus, or focusing one with no scroll view at all, would
  // leave the bar wherever the last screen parked it. Any change of who owns the host, or a pin
  // engaging (which also turns the scroll handlers off, so nothing else would ever bring it back),
  // starts from fully revealed.
  useEffect(() => {
    reveal()
  }, [activeId, pinned, reveal])
  const host = useMemo(() => ({ activeId, claim, footprint, offset, overhang, pinned, release, reveal, snapBack, useIsActive }), [activeId, claim, footprint, offset, overhang, pinned, release, reveal, snapBack, useIsActive])
  const chrome = useMemo(() => ({ addPin, footprint, offset, overhang, removePin, reveal }), [addPin, footprint, offset, overhang, removePin, reveal])
  return (
    <ScrollViewChromeContext.Provider value={chrome}>
      <ScrollViewChromeHostContext.Provider value={host}>{children}</ScrollViewChromeHostContext.Provider>
    </ScrollViewChromeContext.Provider>
  )
}
