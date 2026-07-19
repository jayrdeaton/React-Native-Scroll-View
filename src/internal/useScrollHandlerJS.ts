import { type RefObject, useCallback, useContext, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { withTiming } from 'react-native-reanimated'

import { ScrollViewContext } from '../ScrollViewContext'
import { usesContentInset } from './insetMode'

const REMOUNT_RETRY_TOLERANCE = 1
const REMOUNT_RETRY_MAX_ATTEMPTS = 8

type UseScrollHandlerJSOptions = {
  capturedGeneration: RefObject<number>
  chipHidden: SharedValue<number>
  chipThreshold?: number
  footerFixed: boolean
  headerFixed: boolean
  isHorizontal?: boolean
  jsListGeneration: RefObject<number>
  remountTarget?: number | null
  scrollTo?: (offset: number, animated: boolean) => void
}

export type ScrollHandlerJS = {
  onMomentumScrollBegin: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
}

// Plain JS-thread scroll handler for a non-Animated scrollable. Reanimated shared values are
// readable/writable from any thread, so driving them via a regular onScroll callback (rather than
// a useAnimatedScrollHandler worklet, which requires an Animated-wrapped component to attach to at
// the native level) works fine here — the header/footer animations just pick up the change on
// their next UI-thread frame. This trades a small amount of latency for a plain scrollable that
// reliably honors the initial `contentOffset` prop on (re)mount, which Animated.FlatList does not.
export function useScrollHandlerJS({ capturedGeneration, chipHidden, chipThreshold = 100, footerFixed, headerFixed, isHorizontal, jsListGeneration, remountTarget = null, scrollTo }: UseScrollHandlerJSOptions): ScrollHandlerJS {
  const { footerHeightShared, footerOffset, headerHeightShared, headerOffset, pullSearchHeightShared, scrollPosition, snapBackFooterShared, snapBackHeaderShared } = useContext(ScrollViewContext)
  const snapUpAccum = useRef(0)
  const fromBottomBounce = useRef(false)
  // On a remount, the very first native position after mount isn't reliable — Fabric can skip
  // reapplying `contentOffset` when the target is numerically unchanged from before, and native
  // scroll settling can overshoot or undershoot it. Rather than trust either the declarative prop
  // or a single imperative scrollTo call, keep correcting (without hiding anything — content stays
  // visible throughout) until an onScroll event actually confirms the intended resting position.
  const pendingRemountTarget = useRef(remountTarget)
  const remountAttempts = useRef(0)

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (jsListGeneration.current !== capturedGeneration.current) return
      const {
        contentOffset: { x, y },
        contentSize: { height: contentHeight },
        layoutMeasurement: { height: layoutHeight }
      } = event.nativeEvent
      if (pendingRemountTarget.current !== null) {
        const target = pendingRemountTarget.current
        if (Math.abs(y - target) < REMOUNT_RETRY_TOLERANCE) {
          pendingRemountTarget.current = null
        } else {
          remountAttempts.current += 1
          if (remountAttempts.current > REMOUNT_RETRY_MAX_ATTEMPTS) {
            pendingRemountTarget.current = null
          } else {
            scrollTo?.(target, false)
            return
          }
        }
      }
      if (isHorizontal) {
        scrollPosition.value = x
        chipHidden.value = x < chipThreshold ? 1 : 0
        return
      }
      // Same inset-space normalization as the worklet handler: rest = -headerHeight everywhere,
      // raw space only for bounce detection against contentSize.
      const yn = usesContentInset ? y : y - headerHeightShared.value
      const delta = yn - scrollPosition.value
      scrollPosition.value = yn
      chipHidden.value = yn < chipThreshold ? 1 : 0
      const maxScroll = contentHeight - layoutHeight
      if (maxScroll > 0 && y >= maxScroll) {
        fromBottomBounce.current = true
        snapUpAccum.current = 0
      } else if (fromBottomBounce.current) {
        fromBottomBounce.current = false
      }
      const snapHeader = snapBackHeaderShared.value && !headerFixed
      const snapFooter = snapBackFooterShared.value && !footerFixed
      if (snapHeader || snapFooter) {
        if (yn <= -headerHeightShared.value) {
          snapUpAccum.current = 0
          if (snapHeader) headerOffset.value = 0
          if (snapFooter) footerOffset.value = 0
        } else if (delta > 0) {
          snapUpAccum.current = 0
          if (yn >= -headerHeightShared.value + pullSearchHeightShared.value) {
            if (snapHeader) headerOffset.value = Math.max(-headerHeightShared.value, Math.min(0, headerOffset.value - delta))
            if (snapFooter) footerOffset.value = Math.max(0, Math.min(footerHeightShared.value, footerOffset.value + delta))
          }
        } else if (delta < 0 && !fromBottomBounce.current) {
          if (yn >= -headerHeightShared.value + pullSearchHeightShared.value) snapUpAccum.current -= delta
          if (snapUpAccum.current >= 10) {
            snapUpAccum.current = 999
            if (snapHeader) headerOffset.value = withTiming(0, { duration: 200 })
            if (snapFooter) footerOffset.value = withTiming(0, { duration: 200 })
          }
        }
      }
    },
    [capturedGeneration, chipHidden, chipThreshold, footerFixed, footerHeightShared, footerOffset, headerFixed, headerHeightShared, headerOffset, isHorizontal, jsListGeneration, pullSearchHeightShared, scrollPosition, scrollTo, snapBackFooterShared, snapBackHeaderShared]
  )

  const onScrollBeginDrag = useCallback(() => {
    fromBottomBounce.current = false
    snapUpAccum.current = 0
  }, [])

  const onMomentumScrollBegin = useCallback(() => {}, [])

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isHorizontal) return
      const {
        contentOffset: { y },
        contentSize: { height: contentHeight },
        layoutMeasurement: { height: layoutHeight }
      } = event.nativeEvent
      if (y >= contentHeight - layoutHeight - 10) {
        fromBottomBounce.current = true
        snapUpAccum.current = 0
      }
    },
    [isHorizontal]
  )

  const onMomentumScrollEnd = useCallback(() => {
    fromBottomBounce.current = false
    snapUpAccum.current = 0
  }, [])

  return { onMomentumScrollBegin, onMomentumScrollEnd, onScroll, onScrollBeginDrag, onScrollEndDrag }
}
