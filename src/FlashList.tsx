import { FlashList as ShopifyFlashList, type FlashListProps as ShopifyFlashListProps } from '@shopify/flash-list'
import { memo, type RefObject, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FAB } from './internal/FAB'
import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewContext } from './ScrollViewContext'

const FAB_WIDTH = 100

type ShopifyFlashListMethods = { scrollToOffset: (params: { offset: number; animated?: boolean }) => void }

export type FlashListProps<T> = ShopifyFlashListProps<T> & {
  footerLock?: boolean
  gesture?: GestureType
  headerLock?: boolean
  onRefresh?: () => void
  ref?: RefObject<ShopifyFlashListMethods | null>
  refreshing?: boolean
}

const FlashListInner = <T,>({ footerLock: footerLockProp, gesture, headerLock: headerLockProp, onRefresh, refreshing, style, ref: externalRef, ...props }: FlashListProps<T>) => {
  const insets = useSafeAreaInsets()
  const fabHidden = useSharedValue(1)
  const scrollView = useRef<ShopifyFlashListMethods>(null)
  const { footerHeight, footerLock: contextFooterLock, headerHeight, headerLock: contextHeaderLock, scrollPosition } = useContext(ScrollViewContext)
  const headerLock = headerLockProp ?? contextHeaderLock
  const footerLock = footerLockProp ?? contextFooterLock
  const containerStyle = useMemo(() => [StyleSheet.absoluteFill, style], [style])
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet'
        runOnJS(setKeyboardHeight)(e.height)
      },
      onEnd: (e) => {
        'worklet'
        runOnJS(setKeyboardHeight)(e.height)
      }
    },
    []
  )
  const contentInset = useMemo(
    () => ({ bottom: footerLock ? footerHeight + keyboardHeight : keyboardHeight + insets.bottom, top: headerHeight }),
    [footerLock, footerHeight, headerHeight, insets.bottom, keyboardHeight]
  )
  const contentOffset = useMemo(() => ({ x: 0, y: -contentInset.top }), [contentInset.top])
  const fabTop = useMemo(() => (headerLock ? headerHeight : insets.top) + 4, [headerLock, headerHeight, insets.top])
  const fabStyle = useAnimatedStyle(() => ({
    opacity: fabHidden.value ? withTiming(0) : withTiming(1),
    transform: [{ translateX: fabHidden.value ? withTiming(FAB_WIDTH) : withTiming(0) }]
  }))
  const handleScroll = useAnimatedScrollHandler(({ contentOffset: { y } }) => {
    scrollPosition.value = y
    fabHidden.value = y < 100 ? 1 : 0
  })
  const handleScrollToTop = useCallback(() => scrollView.current?.scrollToOffset({ offset: -contentInset.top, animated: true }), [contentInset.top])
  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const content = (
    <View style={containerStyle}>
      <ShopifyFlashList
        {...props}
        contentInset={contentInset}
        contentOffset={contentOffset}
        onRefresh={onRefresh}
        onScroll={handleScroll}
        ref={(el) => {
          if (externalRef) externalRef.current = el as ShopifyFlashListMethods | null
          scrollView.current = el as ShopifyFlashListMethods | null
        }}
        refreshControl={refreshControl}
        refreshing={refreshing}
        scrollEventThrottle={16}
      />
      <Animated.View style={[styles.fab, { top: fabTop }, fabStyle]}>
        <FAB icon='chevron-up' onPress={handleScrollToTop} />
      </Animated.View>
    </View>
  )
  return gesture ? <GestureDetector gesture={gesture}>{content}</GestureDetector> : content
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 4, zIndex: 3 }
})

export const FlashList = memo(FlashListInner) as typeof FlashListInner
