import { type ComponentType, memo, type RefObject, useCallback, useContext, useEffect, useMemo } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { Chip } from 'react-native-paper'
import Animated, { useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewContext } from './ScrollViewContext'
import { useKeyboardInset } from './useKeyboardInset'
import { useScrollInit } from './useScrollInit'

const CHIP_SLIDE = 48

type ScrollToOffsetRef = { scrollToOffset: (params: { animated?: boolean; offset: number }) => void }

export type CustomListProps<P extends object> = Omit<P, 'contentInset' | 'contentOffset' | 'onScroll' | 'refreshControl' | 'scrollEventThrottle'> & {
  component: ComponentType<P>
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onRefresh?: () => void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  refreshing?: boolean
  scrollRef?: RefObject<ScrollToOffsetRef | null>
  style?: StyleProp<ViewStyle>
}

const CustomListInner = <P extends object>({ component: List, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, scrollRef, style, ...props }: CustomListProps<P>) => {
  const insets = useSafeAreaInsets()
  const chipHidden = useSharedValue(1)
  const { footerHeight, footerFixed: contextFooterLock, headerHeight, headerFixed: contextHeaderLock, pullSearchHeightShared, scrollPosition } = useContext(ScrollViewContext)
  const headerFixed = headerFixedProp ?? contextHeaderLock
  const footerFixed = footerFixedProp ?? contextFooterLock
  const keyboardHeight = useKeyboardInset()

  useEffect(() => {
    pullSearchHeightShared.value = pullSearchHeight ?? 0
  }, [pullSearchHeight, pullSearchHeightShared])
  const containerStyle = useMemo(() => [StyleSheet.absoluteFill, style], [style])
  const contentInset = useMemo(
    () => ({ bottom: (footerFixed ? footerHeight || insets.bottom : insets.bottom) + (keyboardAware ? keyboardHeight : 0), left: 0, right: 0, top: headerHeight }),
    [footerFixed, footerHeight, insets.bottom, headerHeight, keyboardAware, keyboardHeight]
  )
  const contentOffset = useMemo(
    () => ({ x: 0, y: pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top }),
    [contentInset.top, pullSearchHeight]
  )
  const chipTop = useMemo(() => (headerFixed ? headerHeight : insets.top) + 4, [headerFixed, headerHeight, insets.top])

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollRef?.current?.scrollToOffset({ offset, animated })
  }, [scrollRef])

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

  const onScroll = useAnimatedScrollHandler(({ contentOffset: { y } }) => {
    scrollPosition.value = y
    chipHidden.value = y < 100 ? 1 : 0
  })
  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollRef?.current?.scrollToOffset({ offset, animated: true })
  }, [contentInset.top, pullSearchHeight, scrollRef])

  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined
  const TypedList = List as ComponentType<{
    contentInset: typeof contentInset
    contentOffset: typeof contentOffset
    onScroll: typeof onScroll
    onScrollBeginDrag: typeof handleScrollBeginDrag
    onScrollEndDrag: typeof handleScrollEndDrag
    ref?: RefObject<ScrollToOffsetRef | null>
    refreshControl: React.ReactElement
    scrollEventThrottle: 16
    [key: string]: unknown
  }>
  const content = (
    <View style={containerStyle}>
      <TypedList {...(props as unknown as Record<string, unknown>)} contentInset={contentInset} contentOffset={contentOffset} onScroll={onScroll} onScrollBeginDrag={handleScrollBeginDrag} onScrollEndDrag={handleScrollEndDrag} ref={scrollRef} refreshControl={refreshControl} scrollEventThrottle={16} />
      {scrollRef && (
        <Animated.View animatedProps={chipAnimatedProps} style={[styles.chip, { top: chipTop }, chipStyle]}>
          <Chip compact icon='chevron-up' onPress={handleScrollToTop} style={styles.chipInner}>
            Top
          </Chip>
        </Animated.View>
      )}
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 },
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
})

export const CustomList = memo(CustomListInner) as typeof CustomListInner
