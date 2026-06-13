import { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from '../ScrollViewContext'

export type StickyHeadersApi = {
  activeIndex: number
  clipStyle: ReturnType<typeof useAnimatedStyle>
  measureHeader: (index: number, y: number, height: number) => void
  overlayStyle: ReturnType<typeof useAnimatedStyle>
  resetPositions: (count: number) => void
}

export function useStickyHeaders(headerFixed: boolean, enabled: boolean): StickyHeadersApi {
  const { headerHeightShared, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared } = useContext(ScrollViewContext)
  const insetsTop = useSafeAreaInsets().top

  const sectionYPositions = useSharedValue<number[]>([])
  const sectionHeights = useSharedValue<number[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  // Mirrors activeIndex React state but lives on the UI thread for overlayStyle.
  // Updated via useLayoutEffect so content and style always change together.
  const contentIndexShared = useSharedValue(-1)
  useLayoutEffect(() => {
    contentIndexShared.value = activeIndex
  }, [activeIndex, contentIndexShared])

  // JS-side source of truth — sectionYPositions is a snapshot pushed to the worklet.
  // Reading sectionYPositions.value from JS returns the UI-thread's stale copy, so
  // rapid async measure callbacks would overwrite each other; refs avoid that.
  const positionsCache = useRef<number[]>([])
  const heightsCache = useRef<number[]>([])

  useAnimatedReaction(
    () => {
      if (!enabled) return -1
      const positions = sectionYPositions.value
      if (positions.length === 0) return -1

      const hHeight = headerHeightShared.value
      const scrollPos = scrollPosition.value
      let stickyTop: number
      if (headerFixed) {
        stickyTop = hHeight
      } else if (snapBackHeaderShared.value) {
        stickyTop = Math.max(insetsTop, hHeight + headerOffset.value)
      } else {
        const effective = scrollPos + hHeight - pullSearchHeightShared.value
        stickyTop = effective <= 0 ? hHeight : Math.max(insetsTop, hHeight - effective)
      }

      const threshold = scrollPos + stickyTop
      let active = -1
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] >= 0 && positions[i] < threshold) active = i
        else if (positions[i] >= 0) break
      }

      return active
    },
    (curr, prev) => {
      if (curr !== prev) runOnJS(setActiveIndex)(curr)
    },
    [enabled, headerFixed, insetsTop]
  )

  // Positions the clip container at stickyTop so overflow:hidden hides the outgoing
  // header as it slides above the sticky line during a push transition.
  const clipStyle = useAnimatedStyle(() => {
    const hHeight = headerHeightShared.value
    const scrollPos = scrollPosition.value
    let stickyTop: number
    if (!enabled || headerFixed) {
      stickyTop = hHeight
    } else if (snapBackHeaderShared.value) {
      stickyTop = Math.max(insetsTop, hHeight + headerOffset.value)
    } else {
      const effective = scrollPos + hHeight - pullSearchHeightShared.value
      stickyTop = effective <= 0 ? hHeight : Math.max(insetsTop, hHeight - effective)
    }
    return { top: stickyTop }
  }, [enabled, headerFixed, insetsTop])

  // overlayStyle positions the header at top:0 relative to the clip container.
  // The push animation uses 1:1 speed with pushThreshold = stickyTop + currentHeight
  // (incoming header touches outgoing header's bottom). The clip container's
  // overflow:hidden hides the outgoing header once it exits the top of the container.
  const overlayStyle = useAnimatedStyle(() => {
    const hidden = { opacity: 0, top: 0, transform: [{ translateY: 0 }] }
    if (!enabled) return hidden

    const index = contentIndexShared.value
    const positions = sectionYPositions.value
    if (index < 0 || index >= positions.length) return hidden

    const hHeight = headerHeightShared.value
    const scrollPos = scrollPosition.value
    let stickyTop: number
    if (headerFixed) {
      stickyTop = hHeight
    } else if (snapBackHeaderShared.value) {
      stickyTop = Math.max(insetsTop, hHeight + headerOffset.value)
    } else {
      const effective = scrollPos + hHeight - pullSearchHeightShared.value
      stickyTop = effective <= 0 ? hHeight : Math.max(insetsTop, hHeight - effective)
    }

    if (positions[index] - scrollPos >= stickyTop) return hidden

    const currentHeight = Math.max(0, sectionHeights.value[index] ?? 0)
    const nextIndex = index + 1
    let translateY = 0
    if (currentHeight > 0 && nextIndex < positions.length && positions[nextIndex] >= 0) {
      const nextScreenY = positions[nextIndex] - scrollPos
      const pushThreshold = stickyTop + currentHeight
      if (nextScreenY < pushThreshold) translateY = nextScreenY - pushThreshold
    }

    return { opacity: 1, top: 0, transform: [{ translateY }] }
  }, [enabled, headerFixed, insetsTop])

  // pageY is the view's window-coordinate Y from view.measure().
  // contentY = pageY + contentOffset.y, since screenY = contentY - contentOffset.y.
  const measureHeader = useCallback(
    (index: number, pageY: number, height: number) => {
      const contentY = pageY + scrollPosition.value
      positionsCache.current[index] = contentY
      sectionYPositions.value = positionsCache.current.slice()

      heightsCache.current[index] = height
      sectionHeights.value = heightsCache.current.slice()
    },
    [scrollPosition, sectionHeights, sectionYPositions]
  )

  const resetPositions = useCallback(
    (count: number) => {
      positionsCache.current = Array.from({ length: count }, () => -1)
      sectionYPositions.value = positionsCache.current.slice()

      heightsCache.current = Array.from({ length: count }, () => -1)
      sectionHeights.value = heightsCache.current.slice()
    },
    [sectionHeights, sectionYPositions]
  )

  return { activeIndex, clipStyle, measureHeader, overlayStyle, resetPositions }
}
