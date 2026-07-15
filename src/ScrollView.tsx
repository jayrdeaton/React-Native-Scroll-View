import { memo, type RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView as RNScrollView, type ScrollViewProps as RNScrollViewProps, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, { runOnUI, useSharedValue } from 'react-native-reanimated'

import { RefreshControl } from './internal/RefreshControl'
import { type ChipProps, ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
import { ScrollViewContext } from './ScrollViewContext'
import { useScrollInit } from './useScrollInit'

export type ScrollViewProps = RNScrollViewProps & {
  chipProps?: ChipProps
  chipThreshold?: number
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onChipPress?: () => void
  onRefresh?: () => void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNScrollView | null>
  refreshing?: boolean
}

const ScrollViewInner = ({ chipProps, chipThreshold, children, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, horizontal, keyboardAware, onChipPress, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, style, ...props }: ScrollViewProps) => {
  const scrollView = useRef<RNScrollView>(null)
  const isHorizontal = horizontal === true

  const { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, isHorizontal, keyboardAware, pullSearchHeight, style })
  const { listGeneration, onListUnmount } = useContext(ScrollViewContext)
  // -1 never matches a real generation (starts at 0, only increments) — the runOnUI call below
  // corrects it before any scroll event could observe the placeholder.
  const capturedGeneration = useSharedValue(-1)
  // Layout effects (not passive effects): React guarantees all layout-effect cleanups for fibers
  // removed in a commit run before any layout-effect setups for fibers added in that same commit,
  // but gives no such ordering guarantee for passive effects. On a key-forced remount, the outgoing
  // instance's unmount and the incoming instance's mount land in the same commit — with passive
  // effects, the incoming instance's sync could run before the outgoing instance's bump, permanently
  // capturing a stale generation and silently disabling this instance's onScroll handling forever.
  // Correct ordering alone isn't sufficient, though: the onScroll worklet reads capturedGeneration
  // on the UI thread, and a plain JS-thread write to a SharedValue is not guaranteed to be visible
  // there before a scroll event the UI thread schedules shortly after (e.g. useScrollInit's mount-time
  // imperative scrollTo calls). Routing the write itself through runOnUI puts it on the UI thread's
  // own serial queue, so it's guaranteed to run before any onScroll worklet invocation that could
  // only be queued after this component finishes mounting.
  useLayoutEffect(() => {
    const generation = listGeneration.value
    runOnUI((gen: number) => {
      'worklet'
      capturedGeneration.value = gen
    })(generation)
  }, [capturedGeneration, listGeneration])
  useLayoutEffect(() => () => onListUnmount(), [onListUnmount])

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.scrollTo({ y: offset, animated })
  }, [])

  const { handleMomentumScrollEnd, handleScrollBeginDrag, handleScrollEndDrag } = useScrollInit({
    onMomentumScrollEnd: externalMomentumScrollEnd,
    onScrollBeginDrag: externalScrollBeginDrag,
    onScrollEndDrag: externalScrollEndDrag,
    pullSearchHeight,
    scrollTo
  })

  const handleScroll = useScrollHandler({ capturedGeneration, chipHidden, chipThreshold, footerFixed, headerFixed, isHorizontal, listGeneration })

  const handleScrollToTop = useCallback(() => {
    if (isHorizontal) {
      scrollView.current?.scrollTo({ x: 0, animated: true })
      return
    }
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.scrollTo({ y: offset, animated: true })
  }, [isHorizontal, contentInset.top, pullSearchHeight])

  const refreshControl = useMemo(() => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />), [onRefresh, refreshing])
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined

  const content = (
    <View style={containerStyle}>
      <Animated.ScrollView
        {...props}
        contentInset={contentInset}
        contentOffset={contentOffset}
        onMomentumScrollEnd={handleMomentumScrollEnd}
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
      <ScrollViewChip chipProps={chipProps} isHorizontal={isHorizontal} onChipPress={onChipPress} onPress={handleScrollToTop} style={chipStyle} />
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

export const ScrollView = memo(ScrollViewInner) as typeof ScrollViewInner
