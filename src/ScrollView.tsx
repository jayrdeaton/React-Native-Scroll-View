import { memo, type RefObject, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView as RNScrollView, type ScrollViewProps as RNScrollViewProps, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { Chip } from 'react-native-paper'
import Animated, { useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewContext } from './ScrollViewContext'
import { useKeyboardInset } from './useKeyboardInset'
import { useScrollInit } from './useScrollInit'

const CHIP_SLIDE = 48

export type ScrollViewProps = RNScrollViewProps & {
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onRefresh?: () => void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNScrollView | null>
  refreshing?: boolean
}

const ScrollViewInner = ({ children, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, style, ...props }: ScrollViewProps) => {
  const insets = useSafeAreaInsets()
  const chipHidden = useSharedValue(1)
  const snapUpAccum = useSharedValue(0)
  const scrollView = useRef<RNScrollView>(null)
  const keyboardHeight = useKeyboardInset()
  const { footerHeight, footerHeightShared, footerFixed: contextFooterFixed, footerOffset, headerHeight, headerHeightShared, headerFixed: contextHeaderFixed, headerOffset, pullSearchHeightShared, scrollPosition, snapBackFooterShared, snapBackHeaderShared } = useContext(ScrollViewContext)
  const headerFixed = headerFixedProp ?? contextHeaderFixed
  const footerFixed = footerFixedProp ?? contextFooterFixed

  useEffect(() => {
    pullSearchHeightShared.value = pullSearchHeight ?? 0
  }, [pullSearchHeight, pullSearchHeightShared])
  const containerStyle = useMemo(() => [StyleSheet.absoluteFill, style], [style])
  const contentInset = useMemo(
    () => ({ bottom: (footerFixed ? footerHeight || insets.bottom : insets.bottom) + (keyboardAware ? keyboardHeight : 0), top: headerHeight }),
    [footerFixed, footerHeight, insets.bottom, headerHeight, keyboardAware, keyboardHeight]
  )
  const chipTop = useMemo(() => (headerFixed ? headerHeight : insets.top) + 4, [headerFixed, headerHeight, insets.top])
  const contentOffset = useMemo(() => ({ x: 0, y: -contentInset.top }), [contentInset.top])

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.scrollTo({ y: offset, animated })
  }, [])

  const { handleScrollBeginDrag, handleScrollEndDrag } = useScrollInit({
    onScrollBeginDrag: externalScrollBeginDrag,
    onScrollEndDrag: externalScrollEndDrag,
    pullSearchHeight,
    scrollTo,
  })

  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipHidden.value ? withTiming(0) : withTiming(1),
    transform: [{ translateY: chipHidden.value ? withTiming(-CHIP_SLIDE) : withTiming(0) }]
  }))
  const chipAnimatedProps = useAnimatedProps(
    () => ({ pointerEvents: chipHidden.value ? 'none' : 'box-none' }) as { pointerEvents: 'none' | 'box-none' }
  )
  const handleScroll = useAnimatedScrollHandler(
    ({ contentOffset: { y } }) => {
      const delta = y - scrollPosition.value
      scrollPosition.value = y
      chipHidden.value = y < 100 ? 1 : 0
      const snapHeader = snapBackHeaderShared.value && !headerFixed
      const snapFooter = snapBackFooterShared.value && !footerFixed
      if (snapHeader || snapFooter) {
        if (y <= -headerHeightShared.value) {
          snapUpAccum.value = 0
          if (snapHeader) headerOffset.value = 0
          if (snapFooter) footerOffset.value = 0
        } else if (delta > 0) {
          snapUpAccum.value = 0
          if (snapHeader) headerOffset.value = Math.max(-headerHeightShared.value, Math.min(0, headerOffset.value - delta))
          if (snapFooter) footerOffset.value = Math.max(0, Math.min(footerHeightShared.value, footerOffset.value + delta))
        } else if (delta < 0) {
          snapUpAccum.value -= delta
          if (snapUpAccum.value >= 10) {
            snapUpAccum.value = 999
            if (snapHeader) headerOffset.value = withTiming(0, { duration: 200 })
            if (snapFooter) footerOffset.value = withTiming(0, { duration: 200 })
          }
        }
      }
    },
    [headerFixed, footerFixed]
  )
  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.scrollTo({ y: offset, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined
  const content = (
    <View style={containerStyle}>
      <Animated.ScrollView
        {...props}
        contentInset={contentInset}
        contentOffset={contentOffset}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        ref={(el: RNScrollView | null) => {
          if (props.ref) props.ref.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
        scrollEventThrottle={16}
      >
        {children}
      </Animated.ScrollView>
      <Animated.View animatedProps={chipAnimatedProps} style={[styles.chip, { top: chipTop }, chipStyle]}>
        <Chip compact icon='chevron-up' onPress={handleScrollToTop} style={styles.chipInner}>
          Top
        </Chip>
      </Animated.View>
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 },
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
})

export const ScrollView = memo(ScrollViewInner) as typeof ScrollViewInner
