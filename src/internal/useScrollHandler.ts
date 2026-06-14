import { useContext } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import { runOnJS, useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated'

import { ScrollViewContext } from '../ScrollViewContext'

type UseScrollHandlerOptions = {
  chipHidden: SharedValue<number>
  chipThreshold?: number
  footerFixed: boolean
  headerFixed: boolean
  isHorizontal?: boolean
  onPullSearchZoneEnter?: () => void
}

export function useScrollHandler({ chipHidden, chipThreshold = 100, footerFixed, headerFixed, isHorizontal, onPullSearchZoneEnter }: UseScrollHandlerOptions) {
  const { footerHeightShared, footerOffset, headerHeightShared, headerOffset, pullSearchHeightShared, scrollPosition, snapBackFooterShared, snapBackHeaderShared } = useContext(ScrollViewContext)
  const snapUpAccum = useSharedValue(0)
  const fromBottomBounce = useSharedValue(false)
  const isMomentum = useSharedValue(false)
  const momentumPullSearchFired = useSharedValue(false)

  return useAnimatedScrollHandler(
    {
      onScroll: ({ contentOffset: { x, y }, contentSize: { height: contentHeight }, layoutMeasurement: { height: layoutHeight } }) => {
        'worklet'
        if (isHorizontal) {
          scrollPosition.value = x
          chipHidden.value = x < chipThreshold ? 1 : 0
          return
        }
        const delta = y - scrollPosition.value
        scrollPosition.value = y
        chipHidden.value = y < chipThreshold ? 1 : 0
        const maxScroll = contentHeight - layoutHeight
        if (maxScroll > 0 && y >= maxScroll) {
          fromBottomBounce.value = true
          snapUpAccum.value = 0
        } else if (fromBottomBounce.value) {
          fromBottomBounce.value = false
        }
        if (isMomentum.value && pullSearchHeightShared.value > 0 && !momentumPullSearchFired.value) {
          const hideY = -headerHeightShared.value + pullSearchHeightShared.value
          if (y < hideY) {
            momentumPullSearchFired.value = true
            if (onPullSearchZoneEnter) runOnJS(onPullSearchZoneEnter)()
          }
        }
        const snapHeader = snapBackHeaderShared.value && !headerFixed
        const snapFooter = snapBackFooterShared.value && !footerFixed
        if (snapHeader || snapFooter) {
          if (y <= -headerHeightShared.value) {
            snapUpAccum.value = 0
            if (snapHeader) headerOffset.value = 0
            if (snapFooter) footerOffset.value = 0
          } else if (delta > 0) {
            snapUpAccum.value = 0
            if (y >= -headerHeightShared.value + pullSearchHeightShared.value) {
              if (snapHeader) headerOffset.value = Math.max(-headerHeightShared.value, Math.min(0, headerOffset.value - delta))
              if (snapFooter) footerOffset.value = Math.max(0, Math.min(footerHeightShared.value, footerOffset.value + delta))
            }
          } else if (delta < 0 && !fromBottomBounce.value) {
            if (y >= -headerHeightShared.value + pullSearchHeightShared.value) snapUpAccum.value -= delta
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
        isMomentum.value = false
        momentumPullSearchFired.value = false
        fromBottomBounce.value = false
        snapUpAccum.value = 0
      },
      onMomentumBegin: () => {
        'worklet'
        isMomentum.value = true
        momentumPullSearchFired.value = false
      },
      onEndDrag: ({ contentOffset: { y }, contentSize: { height: contentHeight }, layoutMeasurement: { height: layoutHeight } }) => {
        'worklet'
        if (isHorizontal) return
        if (y >= contentHeight - layoutHeight - 10) {
          fromBottomBounce.value = true
          snapUpAccum.value = 0
        }
      },
      onMomentumEnd: () => {
        'worklet'
        isMomentum.value = false
        momentumPullSearchFired.value = false
        fromBottomBounce.value = false
        snapUpAccum.value = 0
      }
    },
    [headerFixed, footerFixed, isHorizontal, chipThreshold, onPullSearchZoneEnter]
  )
}
