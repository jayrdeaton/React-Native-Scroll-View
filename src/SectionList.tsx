import { memo, type RefObject, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, SectionList as RNSectionList, type SectionListProps as RNSectionListProps, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { Chip } from 'react-native-paper'
import Animated, { useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewContext } from './ScrollViewContext'
import { useKeyboardInset } from './useKeyboardInset'
import { useScrollInit } from './useScrollInit'

const CHIP_SLIDE = 48

export type SectionListProps<ItemT, SectionT extends { data: ReadonlyArray<ItemT> } = { data: ReadonlyArray<ItemT> }> = RNSectionListProps<ItemT, SectionT> & {
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNSectionList<ItemT, SectionT> | null>
}

const SectionListInner = <ItemT, SectionT extends { data: ReadonlyArray<ItemT> } = { data: ReadonlyArray<ItemT> }>({ contentContainerStyle: externalContentContainerStyle, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, ListHeaderComponent: externalListHeaderComponent, onRefresh, onContentSizeChange, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, sections, style, ref: externalRef, ...props }: SectionListProps<ItemT, SectionT>) => {
  const insets = useSafeAreaInsets()
  const chipHidden = useSharedValue(1)
  const scrollView = useRef<RNSectionList<ItemT, SectionT>>(null)
  const keyboardHeight = useKeyboardInset()
  const { footerHeight, footerFixed: contextFooterLock, headerHeight, headerFixed: contextHeaderLock, pullSearchHeightShared, scrollPosition } = useContext(ScrollViewContext)
  const headerFixed = headerFixedProp ?? contextHeaderLock
  const footerFixed = footerFixedProp ?? contextFooterLock

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
    scrollView.current?.getScrollResponder()?.scrollTo({ y: offset, animated })
  }, [])

  const { activeListHeader, handleScrollBeginDrag, handleScrollEndDrag, hiddenHeader, pullSearchMinHeight } = useScrollInit({
    listHeaderComponent: externalListHeaderComponent,
    onScrollBeginDrag: externalScrollBeginDrag,
    onScrollEndDrag: externalScrollEndDrag,
    pullSearchHeight,
    scrollTo,
  })

  // minHeight must include pullSearchMinHeight so the scroll range reaches hideY.
  // Without it, maxScrollOffset = -headerHeight and scrollTo(hideY) is silently clamped.
  const contentContainerStyle = useMemo(
    () => [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom + pullSearchMinHeight }, externalContentContainerStyle],
    [contentInset.bottom, contentInset.top, externalContentContainerStyle, pullSearchMinHeight]
  )

  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipHidden.value ? withTiming(0) : withTiming(1),
    transform: [{ translateY: chipHidden.value ? withTiming(-CHIP_SLIDE) : withTiming(0) }]
  }))
  const chipAnimatedProps = useAnimatedProps(
    () => ({ pointerEvents: chipHidden.value ? 'none' : 'box-none' }) as { pointerEvents: 'none' | 'box-none' }
  )

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => { if (onContentSizeChange) onContentSizeChange(w, h) },
    [onContentSizeChange]
  )
  const handleScroll = useAnimatedScrollHandler(({ contentOffset: { y } }) => {
    scrollPosition.value = y
    chipHidden.value = y < 100 ? 1 : 0
  })
  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.getScrollResponder()?.scrollTo({ y: offset, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const renderScrollComponent = useCallback((_props: any) => <Animated.ScrollView {..._props} onScroll={handleScroll} />, [handleScroll])
  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined

  const content = (
    <View style={containerStyle}>
      <RNSectionList
        {...props}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentOffset={contentOffset}
        initialNumToRender={20}
        ListHeaderComponent={activeListHeader}
        maxToRenderPerBatch={50}
        onContentSizeChange={handleContentSizeChange}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        ref={(el) => {
          if (externalRef) externalRef.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
        removeClippedSubviews={false}
        renderScrollComponent={renderScrollComponent}
        scrollEventThrottle={16}
        sections={sections}
        showsVerticalScrollIndicator
        windowSize={100}
      />
      {hiddenHeader && (
        <View pointerEvents='none' style={styles.measureContainer}>
          {hiddenHeader}
        </View>
      )}
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
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 },
  measureContainer: { left: 0, opacity: 0, position: 'absolute', right: 0, top: -9999 }
})

export const SectionList = memo(SectionListInner) as typeof SectionListInner
