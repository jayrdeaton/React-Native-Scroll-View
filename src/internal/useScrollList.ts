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
  hideUntilMeasured?: boolean
  isHorizontal?: boolean
  keyboardAware?: boolean
  pullSearchHeight?: number
  style?: StyleProp<ViewStyle>
}

export function useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, hideUntilMeasured, isHorizontal, keyboardAware, pullSearchHeight, style }: UseScrollListOptions = {}) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardInset()
  const { footerAboveKeyboard, footerHeight, footerFixed: contextFooterFixed, headerHeight, headerFixed: contextHeaderFixed, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared, tabBarHeight } = useContext(ScrollViewContext)

  const headerFixed = isHorizontal ? true : (headerFixedProp ?? contextHeaderFixed)
  const footerFixed = isHorizontal ? true : (footerFixedProp ?? contextFooterFixed)

  useEffect(() => {
    pullSearchHeightShared.value = usesContentInset ? (pullSearchHeight ?? 0) : 0
  }, [pullSearchHeight, pullSearchHeightShared])

  // First render (headerHeight===null): flex:1, sitting naturally below the in-flow header —
  // same visual position content ends up in after the swap below (absoluteFill + paddingTop
  // matching the now-measured headerHeight), so no hiding is needed for this transition on its
  // own. hideUntilMeasured is only for SectionList: its key={headerHeight>0?1:0} forces a real
  // remount of the underlying native list on this exact transition, and that remount is what
  // needs hiding, not this container swap itself — ScrollView/FlatList/CustomList never remount
  // here, so unconditionally hiding this container regressed a real "flash of blank" on every
  // fresh mount for them (2026-08-03).
  const containerStyle = useMemo(() => (headerHeight === null ? [{ flex: 1, opacity: hideUntilMeasured ? 0 : 1 }, style] : [StyleSheet.absoluteFill, style]), [headerHeight, hideUntilMeasured, style])

  // tabBarHeight reserves space for a consuming app's own persistent tab bar - a fixture outside
  // this package's header/footer concepts entirely, so it's added on top of whichever base the
  // footerFixed branch below resolves to (footerHeight already bakes in insets.bottom itself; see
  // ScrollViewFooter's own paddingBottom).
  //
  // When footerAboveKeyboard opts the (fixed) footer into floating above the keyboard instead of
  // sitting behind it, footerHeight ALREADY includes the current keyboardHeight — ScrollViewFooter
  // grows its own container by keyboardHeight to float (see its containerPaddingBottom), rather
  // than translating a fixed-height bar, so onLayout reports the combined height. Adding
  // keyboardHeight again here would double-count it. Otherwise (not floating) ScrollViewFooter pins
  // itself with plain `position: 'absolute', bottom: 0` with no keyboard-awareness of its own, so
  // an open keyboard simply covers it rather than stacking above it - reserving
  // footerReserve + keyboardHeight in that case would leave a gap the size of the now-hidden footer
  // between the focused input and the keyboard, so max() reserves only whichever bottom obstruction
  // is actually taller right now.
  const insetGeometry = useMemo(() => {
    const footerReserve = footerFixed ? footerHeight || insets.bottom : insets.bottom
    const bottom = (!keyboardAware || (footerFixed && footerAboveKeyboard) ? footerReserve : Math.max(footerReserve, keyboardHeight)) + tabBarHeight
    return { bottom, top: headerHeight ?? 0 }
  }, [footerAboveKeyboard, footerFixed, footerHeight, insets.bottom, tabBarHeight, headerHeight, keyboardAware, keyboardHeight])
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
  // chipHidden/snapBackHeaderShared/headerOffset/scrollPosition/pullSearchHeightShared all need to
  // be listed here too, not just read — see ScrollViewHeader's translateStyle for why (web-only
  // reanimated reactivity gap: a SharedValue's mutations don't retrigger useAnimatedStyle unless
  // the value itself is in this array).
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
  }, [isHorizontal, headerFixed, headerHeight, insets.top, chipHidden, snapBackHeaderShared, headerOffset, scrollPosition, pullSearchHeightShared])

  return { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, contentPadding, footerFixed, headerFixed, headerHeight, insets, isHorizontal: isHorizontal ?? false }
}
