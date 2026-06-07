import { memo, type RefObject, useCallback, useContext, useMemo, useRef } from 'react'
import { Dimensions, type FlatListProps as RNFlatListProps, FlatList as RNFlatList, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FAB } from './internal/FAB'
import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewContext } from './ScrollViewContext'
import { type ScrollViewProps } from './ScrollView'

const FAB_WIDTH = 100

export type FlatListProps<T> = RNFlatListProps<T> & {
  footerLock?: boolean
  gesture?: GestureType
  headerLock?: boolean
  ref?: RefObject<RNFlatList | null>
}

const FlatListInner = <T,>({ contentContainerStyle: externalContentContainerStyle, footerLock: footerLockProp, gesture, headerLock: headerLockProp, horizontal, onRefresh, refreshing, style, onContentSizeChange, ref: externalRef, ...props }: FlatListProps<T>) => {
  const insets = useSafeAreaInsets()
  const fabHidden = useSharedValue(1)
  const scrollView = useRef<RNFlatList>(null)
  const { footerHeight, footerLock: contextFooterLock, headerHeight, headerLock: contextHeaderLock, scrollPosition } = useContext(ScrollViewContext)
  const headerLock = headerLockProp ?? contextHeaderLock
  const footerLock = footerLockProp ?? contextFooterLock
  const isHorizontal = horizontal === true
  const containerStyle = useMemo(() => [StyleSheet.absoluteFill, style], [style])
  const contentInset = useMemo(() => ({ bottom: footerLock ? footerHeight || insets.bottom : insets.bottom, top: headerHeight }), [footerLock, footerHeight, insets.bottom, headerHeight])
  const contentOffset = useMemo(() => ({ x: 0, y: -contentInset.top }), [contentInset.top])
  const contentContainerStyle = useMemo(
    () => [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom }, externalContentContainerStyle],
    [contentInset.bottom, contentInset.top, externalContentContainerStyle]
  )
  const fabTop = useMemo(() => (headerLock ? headerHeight : insets.top) + 4, [headerLock, headerHeight, insets.top])
  const fabStyle = useAnimatedStyle(() => ({
    opacity: fabHidden.value ? withTiming(0) : withTiming(1),
    transform: [{ translateX: fabHidden.value ? withTiming(FAB_WIDTH) : withTiming(0) }]
  }))
  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      if (onContentSizeChange) onContentSizeChange(w, h)
    },
    [onContentSizeChange]
  )
  const handleScroll = useAnimatedScrollHandler(({ contentOffset: { y } }) => {
    scrollPosition.value = y
    fabHidden.value = y < 100 ? 1 : 0
  })
  const handleScrollToTop = useCallback(() => scrollView.current?.scrollToOffset({ offset: -contentInset.top, animated: true }), [contentInset.top])
  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const renderScrollComponent = useCallback((_props: ScrollViewProps) => <KeyboardAwareScrollView {..._props} onScroll={handleScroll} />, [handleScroll])
  const detectorGesture = useMemo(() => {
    try {
      return gesture ? Gesture.Simultaneous(gesture, Gesture.Native()) : undefined
    } catch {
      return gesture
    }
  }, [gesture])
  const content = (
    <View style={containerStyle}>
      <RNFlatList
        {...props}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentOffset={contentOffset}
        horizontal={isHorizontal}
        maxToRenderPerBatch={50}
        onContentSizeChange={handleContentSizeChange}
        ref={(el) => {
          if (externalRef) externalRef.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
        removeClippedSubviews={false}
        renderScrollComponent={renderScrollComponent}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={isHorizontal}
        showsVerticalScrollIndicator={!isHorizontal}
        windowSize={100}
      />
      <Animated.View style={[styles.fab, { top: fabTop }, fabStyle]}>
        <FAB icon='chevron-up' onPress={handleScrollToTop} />
      </Animated.View>
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 4, zIndex: 3 }
})

export const FlatList = memo(FlatListInner) as typeof FlatListInner
