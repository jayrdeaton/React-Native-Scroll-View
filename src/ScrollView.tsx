import { memo, type RefObject, useCallback, useMemo, useRef } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView as RNScrollView, type ScrollViewProps as RNScrollViewProps, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { RefreshControl } from './internal/RefreshControl'
import { type ChipProps, ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
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

  const onPullSearchZoneEnter = useCallback(() => {
    if (!pullSearchHeight) return
    scrollTo(-contentInset.top + pullSearchHeight, true)
  }, [contentInset.top, pullSearchHeight, scrollTo])

  const handleScroll = useScrollHandler({ chipHidden, chipThreshold, footerFixed, headerFixed, isHorizontal, onPullSearchZoneEnter: pullSearchHeight ? onPullSearchZoneEnter : undefined })

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
