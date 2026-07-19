import { type ComponentType, createElement, type ReactElement, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { type SharedValue, useSharedValue } from 'react-native-reanimated'

import { usesContentInset } from './internal/insetMode'
import { ScrollViewContext } from './ScrollViewContext'

const REMOUNT_SYNC_MAX_ATTEMPTS = 8
const REMOUNT_SYNC_TOLERANCE = 1
const REMOUNT_SYNC_FALLBACK_MS = 500
const REMOUNT_PRIME_FRAMES = 40
const SNAP_VERIFY_TOLERANCE = 1
const SNAP_VERIFY_MAX_ATTEMPTS = 5
// Long enough to comfortably outlast RN's default animated scrollTo duration (iOS's native
// setContentOffset:animated: for a typical pull-search distance settles well within this) — see
// the comment on scheduleSnapVerification for why a native onMomentumScrollEnd event can't be used
// as this signal instead.
const SNAP_VERIFY_INITIAL_DELAY_MS = 400
const SNAP_VERIFY_RETRY_DELAY_MS = 150

export type UseScrollInitOptions = {
  listHeaderComponent?: ComponentType<object> | ReactElement | null
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRefresh?: () => Promise<void> | void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  scrollTo: (offset: number, animated: boolean) => void
}

export type UseScrollInitResult = {
  activeListHeader: ComponentType<object> | ReactElement | null | undefined
  handleMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  hiddenHeader: ReactElement | null
  onRemountSyncRetry: (currentY: number) => void
  onRemountSynced: (y: number) => void
  pullSearchMinHeight: number
  remountSyncTarget: SharedValue<number | null>
  remountTarget: number | null
  scrollReady: boolean
}

export function useScrollInit({ listHeaderComponent, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight: pullSearchHeightProp, scrollTo }: UseScrollInitOptions): UseScrollInitResult {
  const { headerHeight, scrollPosition, setProgressing } = useContext(ScrollViewContext)
  // Pull-search rides iOS overscroll physics; outside inset mode it never engages.
  const pullSearchHeight = usesContentInset ? pullSearchHeightProp : undefined
  const hasPullSearch = pullSearchHeight !== undefined
  // Start 'ready' immediately if headerHeight is already known (e.g. FlatList remount on mode
  // switch). Only enter 'measuring' on the very first mount when headerHeight hasn't been set yet.
  const [phase, setPhase] = useState<'measuring' | 'ready'>(hasPullSearch && !headerHeight ? 'measuring' : 'ready')
  const [refreshing, setRefreshing] = useState(false)
  // A plain-ref mirror of `refreshing`, read from inside the deferred timeout below — that
  // callback can fire well after the render that scheduled it, so it needs the *current* value,
  // not whatever `refreshing` closed over at schedule time.
  const refreshingRef = useRef(refreshing)
  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])
  const dragStartY = useRef<number | null>(null)
  // Which pull-search resting position (showY or hideY) a drag-release most recently committed
  // to, so a late fallback in handleMomentumScrollEnd knows not to fight it — see
  // scheduleSnapVerification below for how this actually gets enforced.
  const pendingSnapTarget = useRef<number | null>(null)
  const snapVerifyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapVerifyAttempts = useRef(0)

  // Verifies a pull-search drag-release (handleScrollEndDrag) actually landed on `target`, and
  // keeps correcting (non-animated, so it lands immediately) until it does. This is deliberately
  // time-based rather than triggered by onMomentumScrollEnd: a slow/controlled release with near-
  // zero velocity fires onMomentumScrollEnd within a couple of milliseconds of the drag ending —
  // long before the *animated* scrollTo call issued moments earlier has had any chance to actually
  // move — so reacting to that event by immediately snapping (non-animated) to the target replaced
  // the intended smooth spring-back animation with a jarring instant jump on every normal pull,
  // not just the pathological case this was built for. Waiting out a fixed delay long enough for a
  // normal animated scrollTo to have finished, then checking the *actual* position via
  // scrollPosition.value (kept live by every onScroll), correctly leaves a genuinely-still-
  // animating transition alone while still catching the real failure mode: a hard, fast fling from
  // deep overscroll where iOS's own rubber-band deceleration outruns our animated scrollTo command
  // and it never arrives on its own.
  const scheduleSnapVerification = useCallback(
    (target: number, delay: number) => {
      if (snapVerifyTimeout.current !== null) clearTimeout(snapVerifyTimeout.current)
      pendingSnapTarget.current = target
      snapVerifyAttempts.current = 0
      const check = () => {
        snapVerifyTimeout.current = null
        if (pendingSnapTarget.current !== target) return
        if (Math.abs(scrollPosition.value - target) <= SNAP_VERIFY_TOLERANCE) {
          pendingSnapTarget.current = null
          return
        }
        snapVerifyAttempts.current += 1
        if (snapVerifyAttempts.current > SNAP_VERIFY_MAX_ATTEMPTS || refreshingRef.current) {
          pendingSnapTarget.current = null
          return
        }
        scrollTo(target, false)
        snapVerifyTimeout.current = setTimeout(check, SNAP_VERIFY_RETRY_DELAY_MS)
      }
      snapVerifyTimeout.current = setTimeout(check, delay)
    },
    [scrollPosition, scrollTo]
  )

  useEffect(
    () => () => {
      if (snapVerifyTimeout.current !== null) clearTimeout(snapVerifyTimeout.current)
    },
    []
  )

  // Remount sync: this instance mounted with headerHeight already known — a key-forced remount
  // (e.g. numColumns toggling between a list and a grid), not a true first mount. The native
  // scroll view's actual position right after such a remount isn't reliable (Fabric's ScrollView
  // recycling and Reanimated's Animated.FlatList can both leave it at a stale or zeroed offset
  // for the first render), so the list stays hidden until a confirmed onScroll event reports the
  // intended resting position, re-issuing the imperative scrollTo in between as needed. This
  // replaces trying to guess how many spurious events to skip.
  // Remount sync exists for Fabric/iOS contentOffset unreliability; padding platforms mount at a
  // plain 0 offset and need none of it.
  const [remountTarget] = useState<number | null>(() => (usesContentInset && headerHeight !== null ? -headerHeight + (pullSearchHeight ?? 0) : null))
  const remountSyncTarget = useSharedValue<number | null>(remountTarget)
  const [scrollReady, setScrollReady] = useState(remountTarget === null)
  const remountAttempts = useRef(0)

  const onRemountSynced = useCallback(
    (y: number) => {
      scrollPosition.value = y
      setScrollReady(true)
    },
    [scrollPosition]
  )

  const onRemountSyncRetry = useCallback(
    (currentY: number) => {
      if (remountTarget === null) return
      remountAttempts.current += 1
      if (remountAttempts.current > REMOUNT_SYNC_MAX_ATTEMPTS) {
        remountSyncTarget.value = null
        onRemountSynced(currentY)
        return
      }
      scrollTo(remountTarget, false)
    },
    [onRemountSynced, remountSyncTarget, remountTarget, scrollTo]
  )

  useEffect(() => {
    if (remountTarget === null) return
    // Prime the correction right after mount in case native doesn't emit an initial onScroll
    // event on its own to kick off the retry loop above.
    scrollTo(remountTarget, false)
    const fallback = setTimeout(() => {
      if (remountSyncTarget.value === null) return
      remountSyncTarget.value = null
      onRemountSynced(remountTarget)
    }, REMOUNT_SYNC_FALLBACK_MS)
    return () => clearTimeout(fallback)
    // Intentionally runs once per mount only, using whatever remountTarget was captured at
    // construction — not a dep that should retrigger this effect.
  }, [])

  // Transition to 'ready' once both measurements are available
  useEffect(() => {
    if (phase === 'ready' || !headerHeight || !pullSearchHeight) return
    scrollPosition.value = -headerHeight + pullSearchHeight
    setPhase('ready')
  }, [phase, headerHeight, pullSearchHeight, scrollPosition])

  // Effect A applies ONLY on an actual remount (remountTarget !== null — this instance mounted with
  // headerHeight already known, e.g. a key-forced remount elsewhere in the tree). It syncs
  // scrollPosition synchronously before first paint and issues a short bounded chain of imperative
  // scrollTo calls, alternating between two offsets far enough apart (30pt — comfortably more than
  // any plausible rounding/measurement noise) to guarantee at least one call can't be mistaken for a
  // no-op. The declarative `contentOffset` prop alone isn't enough on a remount: when the target is
  // numerically identical to what it was before (headerHeight/pullSearchHeight don't change across a
  // mode toggle), Fabric's prop diffing can skip reapplying it to a recycled native view, which can
  // be left at whatever position it actually drifted to. Worse, iOS's imperative scrollToOffset
  // short-circuits with a CGPointEqualToPoint check against the native view's *actual* current
  // contentOffset before it will fire the native scroll-finished callback that RN turns into an
  // onScroll event — so a single differing call can still go unnoticed if it happens to race content
  // that's still growing. Alternating across the *entire* correction window, not just the first
  // couple of frames, forces a real scroll-finished callback so drift becomes observable and the
  // onScroll-driven retry loop in useScrollHandlerJS can correct it.
  //
  // On a true first mount (remountTarget === null) this effect does nothing beyond a single
  // insurance call against the destination view silently ignoring the very first scroll command
  // because it isn't fully installed in the window hierarchy yet (e.g. mid native-stack push
  // transition) — a fresh, non-recycled native view reliably honors the declarative contentOffset
  // prop otherwise. Repeating or oscillating that call here fights Effect B below, whose entire job
  // on a true first mount with pull-search is to push the position on from here to hideY: if this
  // effect keeps re-asserting its own target for tens of frames, it can win the race and leave the
  // pull-search bar stuck visible instead of pulled away, or eat scroll gestures attempted during
  // that window.
  const headerInitialized = useRef(false)
  useLayoutEffect(() => {
    if (!headerHeight || headerInitialized.current) return
    headerInitialized.current = true
    const target = remountTarget ?? -headerHeight
    scrollPosition.value = target
    // Imperative scroll targets are raw-space: inset mode rests at -headerHeight, padding mode at 0.
    scrollTo(usesContentInset ? target : 0, false)
    if (remountTarget === null) return
    let framesLeft = REMOUNT_PRIME_FRAMES
    let handle: number | null = null
    const tick = () => {
      const offset = framesLeft === 1 ? target : framesLeft % 2 === 0 ? target + 30 : target - 30
      scrollTo(offset, false)
      framesLeft -= 1
      if (framesLeft > 0) handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => {
      if (handle !== null) cancelAnimationFrame(handle)
    }
  }, [remountTarget, headerHeight, scrollPosition, scrollTo])

  // Effect B: true first-mount only, with pull search. Pushes from showY to hideY once ready.
  // Remounts already land directly on hideY via the remount-sync mechanism above.
  const pullSearchInitialized = useRef(false)
  useLayoutEffect(() => {
    if (remountTarget !== null || !hasPullSearch || phase !== 'ready' || pullSearchInitialized.current || !headerHeight || !pullSearchHeight || !scrollReady) return
    pullSearchInitialized.current = true
    scrollPosition.value = -headerHeight + pullSearchHeight
    scrollTo(-headerHeight + pullSearchHeight, false)
  }, [remountTarget, hasPullSearch, phase, headerHeight, pullSearchHeight, scrollPosition, scrollReady, scrollTo])

  useEffect(() => {
    if (pullSearchHeight) setProgressing(refreshing)
  }, [pullSearchHeight, refreshing, setProgressing])

  const handleScrollBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (snapVerifyTimeout.current !== null) {
        clearTimeout(snapVerifyTimeout.current)
        snapVerifyTimeout.current = null
      }
      pendingSnapTarget.current = null
      if (pullSearchHeight) dragStartY.current = e.nativeEvent.contentOffset.y
      externalScrollBeginDrag?.(e)
    },
    [externalScrollBeginDrag, pullSearchHeight]
  )

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pullSearchHeight && headerHeight) {
        const y = e.nativeEvent.contentOffset.y
        const showY = -headerHeight
        const hideY = -headerHeight + pullSearchHeight
        const startY = dragStartY.current
        dragStartY.current = null
        const pulledDown = (startY ?? hideY) <= hideY
        const dragDistance = startY !== null ? startY - y : 0
        if (pulledDown && dragDistance >= pullSearchHeight * 0.5) {
          if (y <= showY && !refreshing && onRefresh) {
            setRefreshing(true)
            Promise.resolve(onRefresh()).finally(() => setRefreshing(false))
          }
          scrollTo(showY, true)
          scheduleSnapVerification(showY, SNAP_VERIFY_INITIAL_DELAY_MS)
        } else if (y < hideY) {
          scrollTo(hideY, true)
          scheduleSnapVerification(hideY, SNAP_VERIFY_INITIAL_DELAY_MS)
        }
      }
      externalScrollEndDrag?.(e)
    },
    [externalScrollEndDrag, headerHeight, onRefresh, pullSearchHeight, refreshing, scheduleSnapVerification, scrollTo]
  )

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pullSearchHeight && headerHeight && !refreshing && pendingSnapTarget.current === null) {
        // No drag committed to a target above (e.g. a fast fling whose whole reveal/overscroll
        // motion happened during momentum, never during the drag itself, so handleScrollEndDrag
        // never saw a y near the pull-search zone) — fall back to auto-closing if we've ended up
        // revealed without ever meaning to.
        const y = e.nativeEvent.contentOffset.y
        const hideY = -headerHeight + pullSearchHeight
        if (y < hideY - 1) {
          scrollTo(hideY, true)
          scheduleSnapVerification(hideY, SNAP_VERIFY_INITIAL_DELAY_MS)
        }
      }
      externalMomentumScrollEnd?.(e)
    },
    [externalMomentumScrollEnd, headerHeight, pullSearchHeight, refreshing, scheduleSnapVerification, scrollTo]
  )

  const activeListHeader = hasPullSearch && phase === 'measuring' ? null : listHeaderComponent
  const hiddenHeader = phase === 'measuring' && listHeaderComponent != null ? (typeof listHeaderComponent === 'function' ? createElement(listHeaderComponent as ComponentType<object>) : (listHeaderComponent as ReactElement)) : null

  return { activeListHeader, handleMomentumScrollEnd, handleScrollBeginDrag, handleScrollEndDrag, hiddenHeader, onRemountSyncRetry, onRemountSynced, pullSearchMinHeight: pullSearchHeight ?? 0, remountSyncTarget, remountTarget, scrollReady }
}

export { REMOUNT_SYNC_TOLERANCE }
