import { useContext } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import { runOnJS, useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated'

import { ScrollViewContext } from '../ScrollViewContext'
import { REMOUNT_SYNC_TOLERANCE } from '../useScrollInit'
import { chromeSettleTarget, chromeTravel } from './chrome'
import { usesContentInset } from './insetMode'

type UseScrollHandlerOptions = {
  capturedGeneration: SharedValue<number>
  chipHidden: SharedValue<number>
  chipThreshold?: number
  footerFixed: boolean
  headerFixed: boolean
  isHorizontal?: boolean
  listGeneration: SharedValue<number>
  onRemountSyncRetry?: (currentY: number) => void
  onRemountSynced?: (y: number) => void
  remountSyncTarget?: SharedValue<number | null>
}

export function useScrollHandler({ capturedGeneration, chipHidden, chipThreshold = 100, footerFixed, headerFixed, isHorizontal, listGeneration, onRemountSyncRetry, onRemountSynced, remountSyncTarget }: UseScrollHandlerOptions) {
  const { chromeHosted, chromeWritable, footerOffset, headerHeightShared, headerOffset, pullSearchHeightShared, scrollPosition, snapBackFooterShared, snapBackHeaderShared, stackHeightShared } = useContext(ScrollViewContext)
  const snapUpAccum = useSharedValue(0)
  const fromBottomBounce = useSharedValue(false)

  return useAnimatedScrollHandler(
    {
      onScroll: ({ contentOffset: { x, y }, contentSize: { height: contentHeight }, layoutMeasurement: { height: layoutHeight } }) => {
        'worklet'
        if (remountSyncTarget && remountSyncTarget.value !== null) {
          const target = remountSyncTarget.value
          if (Math.abs(y - target) < REMOUNT_SYNC_TOLERANCE) {
            remountSyncTarget.value = null
            if (onRemountSynced) runOnJS(onRemountSynced)(y)
          } else if (onRemountSyncRetry) {
            runOnJS(onRemountSyncRetry)(y)
          }
          return
        }
        if (listGeneration.value !== capturedGeneration.value) return
        if (isHorizontal) {
          scrollPosition.value = x
          chipHidden.value = x < chipThreshold ? 1 : 0
          return
        }
        // Normalize into inset space (rest = -headerHeight) on platforms that emulate the bars
        // with content padding; bounce detection below stays in the raw space contentSize lives in.
        const yn = usesContentInset ? y : y - headerHeightShared.value
        const delta = yn - scrollPosition.value
        scrollPosition.value = yn
        chipHidden.value = yn < chipThreshold ? 1 : 0
        const maxScroll = contentHeight - layoutHeight
        if (maxScroll > 0 && y >= maxScroll) {
          fromBottomBounce.value = true
          snapUpAccum.value = 0
        } else if (fromBottomBounce.value) {
          fromBottomBounce.value = false
        }
        const snapHeader = snapBackHeaderShared.value && !headerFixed
        // A hosted footer is one half of a stack that has to slide its full hide distance to clear
        // the screen; a list that can't scroll that far (short content) would strand the stack half
        // hidden with no way to finish the job, so it never starts hiding in the first place.
        const hideable = !chromeHosted || chromeTravel(maxScroll, headerHeightShared.value) >= stackHeightShared.value
        if (chromeHosted && !hideable && chromeWritable.value && footerOffset.value !== 0) footerOffset.value = 0
        const snapFooter = snapBackFooterShared.value && !footerFixed && chromeWritable.value && hideable
        if (snapHeader || snapFooter) {
          if (yn <= -headerHeightShared.value) {
            snapUpAccum.value = 0
            if (snapHeader) headerOffset.value = 0
            if (snapFooter) footerOffset.value = 0
          } else if (delta > 0) {
            snapUpAccum.value = 0
            if (yn >= -headerHeightShared.value + pullSearchHeightShared.value) {
              if (snapHeader) headerOffset.value = Math.max(-headerHeightShared.value, Math.min(0, headerOffset.value - delta))
              if (snapFooter) footerOffset.value = Math.max(0, Math.min(stackHeightShared.value, footerOffset.value + delta))
            }
          } else if (delta < 0 && !fromBottomBounce.value) {
            if (yn >= -headerHeightShared.value + pullSearchHeightShared.value) snapUpAccum.value -= delta
            if (snapUpAccum.value >= 10) {
              snapUpAccum.value = 999
              if (snapHeader) headerOffset.value = withTiming(0, { duration: 200 })
              if (snapFooter) footerOffset.value = withTiming(0, { duration: 200 })
            }
          }
        }
      },
      onBeginDrag: () => {
        'worklet'
        fromBottomBounce.value = false
        snapUpAccum.value = 0
      },
      onEndDrag: ({ contentOffset: { y }, contentSize: { height: contentHeight }, layoutMeasurement: { height: layoutHeight }, velocity }) => {
        'worklet'
        if (isHorizontal) return
        // The 10pt scroll-up latch (snapUpAccum >= 10) has already started animating the footer offset
        // back to 0; read it before anything below resets it, because settling on the in-flight value
        // instead could pick "hidden" and reverse a deliberate reveal.
        const revealing = snapUpAccum.value >= 10
        if (y >= contentHeight - layoutHeight - 10) {
          fromBottomBounce.value = true
          snapUpAccum.value = 0
        }
        // A drag that released with momentum still to come keeps writing the offset through it, and
        // settles when that ends; only a release that will genuinely stop here settles now.
        if (chromeHosted && !footerFixed && chromeWritable.value && (velocity === undefined || Math.abs(velocity.y) < 0.1)) {
          footerOffset.value = withTiming(revealing ? 0 : chromeSettleTarget(footerOffset.value, stackHeightShared.value), { duration: 200 })
        }
      },
      onMomentumEnd: () => {
        'worklet'
        const revealing = snapUpAccum.value >= 10
        fromBottomBounce.value = false
        snapUpAccum.value = 0
        // Hosted: scroll tracks 1:1, so it can stop with the stack half hidden. The bar is the app's
        // primary navigation, so it comes to rest fully shown or fully hidden, never cut off.
        if (chromeHosted && !isHorizontal && !footerFixed && chromeWritable.value) {
          footerOffset.value = withTiming(revealing ? 0 : chromeSettleTarget(footerOffset.value, stackHeightShared.value), { duration: 200 })
        }
      }
    },
    [capturedGeneration, chromeHosted, headerFixed, footerFixed, isHorizontal, chipThreshold, listGeneration, onRemountSyncRetry, onRemountSynced, remountSyncTarget]
  )
}
