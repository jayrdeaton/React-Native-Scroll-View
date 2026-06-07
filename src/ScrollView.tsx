import { type ComponentRef, memo, type RefObject, useCallback, useContext, useMemo, useRef } from 'react'
import { type ScrollViewProps as RNScrollViewProps, StyleSheet, View } from 'react-native'
import { GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FAB } from './internal/FAB'
import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewContext } from './ScrollViewContext'

const FAB_WIDTH = 100

type KeyboardAwareScrollViewRef = ComponentRef<typeof KeyboardAwareScrollView>

export type ScrollViewProps = RNScrollViewProps & {
  footerLock?: boolean
  gesture?: GestureType
  headerLock?: boolean
  onRefresh?: () => void
  ref?: RefObject<KeyboardAwareScrollViewRef | null>
  refreshing?: boolean
}

const ScrollViewInner = ({ children, footerLock: footerLockProp, gesture, headerLock: headerLockProp, onRefresh, refreshing, style, ...props }: ScrollViewProps) => {
  const insets = useSafeAreaInsets()
  const fabHidden = useSharedValue(1)
  const scrollView = useRef<KeyboardAwareScrollViewRef>(null)
  const { footerHeight, footerLock: contextFooterLock, headerHeight, headerLock: contextHeaderLock, scrollPosition } = useContext(ScrollViewContext)
  const headerLock = headerLockProp ?? contextHeaderLock
  const footerLock = footerLockProp ?? contextFooterLock
  const containerStyle = useMemo(() => [StyleSheet.absoluteFill, style], [style])
  const contentInset = useMemo(() => ({ bottom: footerLock ? footerHeight || insets.bottom : insets.bottom, top: headerHeight }), [footerLock, footerHeight, insets.bottom, headerHeight])
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
  const handleScrollToTop = useCallback(() => scrollView.current?.scrollTo({ y: -contentInset.top, animated: true }), [contentInset.top])
  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const content = (
    <View style={containerStyle}>
      <KeyboardAwareScrollView
        {...props}
        bottomOffset={footerLock ? footerHeight + 2 : 2}
        contentInset={contentInset}
        contentOffset={contentOffset}
        extraKeyboardSpace={8}
        onScroll={handleScroll}
        ref={(el) => {
          if (props.ref) props.ref.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
      >
        {children}
      </KeyboardAwareScrollView>
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

export const ScrollView = memo(ScrollViewInner) as typeof ScrollViewInner
