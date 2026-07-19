import { useContext, useEffect, useMemo, useState } from 'react'
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native'
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from '../ScrollViewContext'
import { useKeyboardInset } from '../useKeyboardInset'
import { usesContentInset } from './insetMode'

const ZERO_INSET = { bottom: 0, top: 0 }
const ZERO_OFFSET = { x: 0, y: 0 }

const CHIP_SLIDE = 48

export type UseScrollListOptions = {
  footerFixed?: boolean
  headerFixed?: boolean
  isHorizontal?: boolean
  keyboardAware?: boolean
  pullSearchHeight?: number
  style?: StyleProp<ViewStyle>
}

export function useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, isHorizontal, keyboardAware, pullSearchHeight, style }: UseScrollListOptions = {}) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardInset()
  const { footerHeight, footerFixed: contextFooterFixed, headerHeight, headerFixed: contextHeaderFixed, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared } = useContext(ScrollViewContext)

  const headerFixed = isHorizontal ? true : (headerFixedProp ?? contextHeaderFixed)
  const footerFixed = isHorizontal ? true : (footerFixedProp ?? contextFooterFixed)

  useEffect(() => {
    pullSearchHeightShared.value = usesContentInset ? (pullSearchHeight ?? 0) : 0
  }, [pullSearchHeight, pullSearchHeightShared])

  // First render (headerHeight===0): flex:1, hidden until header measures so the key=0→1
  // transition (and contentOffset change) never appears as a visible jump.
  // After header measures: absoluteFill with correct contentOffset — then reveal.
  const containerStyle = useMemo(() => (headerHeight === null ? [{ flex: 1, opacity: 0 }, style] : [StyleSheet.absoluteFill, style]), [headerHeight, style])

  const insetGeometry = useMemo(() => ({ bottom: (footerFixed ? footerHeight || insets.bottom : insets.bottom) + (keyboardAware ? keyboardHeight : 0), top: headerHeight ?? 0 }), [footerFixed, footerHeight, insets.bottom, headerHeight, keyboardAware, keyboardHeight])
  // Outside inset mode the same geometry is applied as content padding instead; contentInset is
  // zeroed (not omitted) so consumers' offset math — scroll-to-top targets, minHeight — stays
  // correct in the raw 0-based coordinate space those platforms actually scroll in.
  const contentInset = usesContentInset ? insetGeometry : ZERO_INSET
  const contentPadding = useMemo(() => (usesContentInset || isHorizontal ? null : { paddingBottom: insetGeometry.bottom, paddingTop: insetGeometry.top }), [insetGeometry, isHorizontal])

  // Use hideY offset only when this component mounted with headerHeight already known (mode switch).
  // On initial load, headerHeight is null at mount so we start at showY and let useScrollInit
  // call scrollTo after the phase transition. On mode switch, headerHeight is already set so we
  // can position the FlatList at hideY atomically via contentOffset — no scrollTo needed.
  const [startedWithHeader] = useState(headerHeight !== null)
  const insetContentOffset = useMemo(() => ({ x: 0, y: headerHeight !== null ? -headerHeight + (startedWithHeader && !isHorizontal && pullSearchHeight ? pullSearchHeight : 0) : 0 }), [headerHeight, isHorizontal, pullSearchHeight, startedWithHeader])
  const contentOffset = usesContentInset ? insetContentOffset : ZERO_OFFSET

  const chipHidden = useSharedValue(1)
  const chipStyle = useAnimatedStyle(() => {
    const pointerEvents = chipHidden.value ? ('none' as const) : ('box-none' as const)
    if (isHorizontal) {
      return {
        opacity: chipHidden.value ? withTiming(0) : withTiming(1),
        pointerEvents,
        top: Math.max(headerHeight ?? 0, insets.top) + 4,
        transform: [{ translateX: chipHidden.value ? withTiming(-CHIP_SLIDE) : withTiming(0) }]
      }
    }
    const h = headerHeight ?? 0
    const slide = headerFixed ? 0 : snapBackHeaderShared.value ? -headerOffset.value : Math.max(0, scrollPosition.value + h - pullSearchHeightShared.value)
    const top = Math.max(h - slide, insets.top) + 4
    return {
      opacity: chipHidden.value ? withTiming(0) : withTiming(1),
      pointerEvents,
      top,
      transform: [{ translateY: chipHidden.value ? withTiming(-CHIP_SLIDE) : withTiming(0) }]
    }
  }, [isHorizontal, headerFixed, headerHeight, insets.top])

  return { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, contentPadding, footerFixed, headerFixed, headerHeight, insets, isHorizontal: isHorizontal ?? false }
}
