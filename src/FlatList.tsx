import { memo, type RefObject, useCallback, useMemo, useRef } from 'react'
import { Dimensions, FlatList as RNFlatList, type FlatListProps as RNFlatListProps, type NativeScrollEvent, type NativeSyntheticEvent, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollInit } from './useScrollInit'
import { useScrollList } from './internal/useScrollList'

export type FlatListProps<T> = RNFlatListProps<T> & {
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNFlatList | null>
}

const FlatListInner = <T,>({ contentContainerStyle: externalContentContainerStyle, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, horizontal, keyboardAware, ListHeaderComponent: externalListHeaderComponent, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, style, onContentSizeChange, ref: externalRef, ...props }: FlatListProps<T>) => {
  const scrollView = useRef<RNFlatList>(null)
  const isHorizontal = horizontal === true

  const { chipAnimatedProps, chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, keyboardAware, pullSearchHeight, style })

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.scrollToOffset({ offset, animated })
  }, [])

  const { activeListHeader, handleScrollBeginDrag, handleScrollEndDrag, hiddenHeader, pullSearchMinHeight } = useScrollInit({
    listHeaderComponent: externalListHeaderComponent,
    onScrollBeginDrag: externalScrollBeginDrag,
    onScrollEndDrag: externalScrollEndDrag,
    pullSearchHeight,
    scrollTo,
  })

  const contentContainerStyle = useMemo(
    () => [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom + pullSearchMinHeight }, externalContentContainerStyle],
    [contentInset.bottom, contentInset.top, externalContentContainerStyle, pullSearchMinHeight]
  )

  const handleScroll = useScrollHandler({ chipHidden, footerFixed, headerFixed })

  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.scrollToOffset({ offset, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => { if (onContentSizeChange) onContentSizeChange(w, h) },
    [onContentSizeChange]
  )

  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />),
    [onRefresh, refreshing]
  )
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined

  const content = (
    <View style={containerStyle}>
      <Animated.FlatList
        {...(props as any)}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentOffset={contentOffset}
        horizontal={isHorizontal}
        initialNumToRender={20}
        ListHeaderComponent={activeListHeader}
        maxToRenderPerBatch={50}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        ref={(el: RNFlatList | null) => {
          if (externalRef) externalRef.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={isHorizontal}
        showsVerticalScrollIndicator={!isHorizontal}
        windowSize={100}
      />
      {hiddenHeader && (
        <View pointerEvents='none' style={styles.measureContainer}>
          {hiddenHeader}
        </View>
      )}
      <ScrollViewChip animatedProps={chipAnimatedProps} onPress={handleScrollToTop} style={chipStyle} />
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = { measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 } }

export const FlatList = memo(FlatListInner) as typeof FlatListInner
