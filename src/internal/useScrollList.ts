import { useContext, useEffect, useMemo } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from '../ScrollViewContext'
import { useKeyboardInset } from '../useKeyboardInset'

const CHIP_SLIDE = 48

export type UseScrollListOptions = {
  footerFixed?: boolean
  headerFixed?: boolean
  keyboardAware?: boolean
  pullSearchHeight?: number
  style?: StyleProp<ViewStyle>
}

export function useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, keyboardAware, pullSearchHeight, style }: UseScrollListOptions = {}) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardInset()
  const { footerHeight, footerFixed: contextFooterFixed, headerHeight, headerFixed: contextHeaderFixed, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared } = useContext(ScrollViewContext)

  const headerFixed = headerFixedProp ?? contextHeaderFixed
  const footerFixed = footerFixedProp ?? contextFooterFixed

  useEffect(() => {
    pullSearchHeightShared.value = pullSearchHeight ?? 0
  }, [pullSearchHeight, pullSearchHeightShared])

  // First render (headerHeight===0): flex:1 so the list sits naturally below the in-flow header.
  // After header measures: absoluteFill with contentOffset to match the same visual position.
  const containerStyle = useMemo(
    () => (headerHeight === 0 ? [{ flex: 1 }, style] : [StyleSheet.absoluteFill, style]),
    [headerHeight, style]
  )

  const contentInset = useMemo(
    () => ({ bottom: (footerFixed ? footerHeight || insets.bottom : insets.bottom) + (keyboardAware ? keyboardHeight : 0), top: headerHeight }),
    [footerFixed, footerHeight, insets.bottom, headerHeight, keyboardAware, keyboardHeight]
  )

  // Synchronously positions the scroll view to match the in-flow layout from the first render.
  // Fabric applies this atomically with the containerStyle switch, so there is no visible jump.
  const contentOffset = useMemo(() => ({ x: 0, y: -contentInset.top }), [contentInset.top])

  const chipHidden = useSharedValue(1)
  const chipStyle = useAnimatedStyle(() => {
    const slide = headerFixed
      ? 0
      : snapBackHeaderShared.value
        ? -headerOffset.value
        : Math.max(0, scrollPosition.value + headerHeight - pullSearchHeightShared.value)
    const top = Math.max(headerHeight - slide, insets.top) + 4
    return {
      opacity: chipHidden.value ? withTiming(0) : withTiming(1),
      top,
      transform: [{ translateY: chipHidden.value ? withTiming(-CHIP_SLIDE) : withTiming(0) }],
    }
  }, [headerFixed, headerHeight, insets.top])
  const chipAnimatedProps = useAnimatedProps(
    () => ({ pointerEvents: chipHidden.value ? 'none' : 'box-none' }) as { pointerEvents: 'none' | 'box-none' }
  )

  return { chipAnimatedProps, chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed, headerHeight, insets }
}
