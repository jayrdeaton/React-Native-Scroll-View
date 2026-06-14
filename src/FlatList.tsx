import { memo, type ReactNode, type RefObject, useCallback, useMemo, useRef } from 'react'
import { Dimensions, FlatList as RNFlatList, type FlatListProps as RNFlatListProps, type NativeScrollEvent, type NativeSyntheticEvent, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { HorizontalDots } from './internal/HorizontalDots'
import { RefreshControl } from './internal/RefreshControl'
import { type ChipProps, ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
import { useScrollInit } from './useScrollInit'

export type FlatListProps<T> = Omit<RNFlatListProps<T>, 'onRefresh' | 'refreshing'> & {
  chipProps?: ChipProps
  chipThreshold?: number
  renderFilters?: ReactNode
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onChipPress?: () => void
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRefresh?: () => Promise<void> | void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNFlatList | null>
}

const FlatListInner = <T,>({ chipProps, chipThreshold, contentContainerStyle: externalContentContainerStyle, data, initialNumToRender = 20, maxToRenderPerBatch = 50, renderFilters, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, horizontal, keyboardAware, ListHeaderComponent: externalListHeaderComponent, onChipPress, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pagingEnabled, pullSearchHeight, removeClippedSubviews = false, showsHorizontalScrollIndicator, showsVerticalScrollIndicator, style, onContentSizeChange, ref: externalRef, windowSize = 100, ...props }: FlatListProps<T>) => {
  const scrollView = useRef<RNFlatList>(null)
  const isHorizontal = horizontal === true
  const showDots = isHorizontal && pagingEnabled === true && (data?.length ?? 0) > 1

  const { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, isHorizontal, keyboardAware, pullSearchHeight, style })

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.scrollToOffset({ offset, animated })
  }, [])

  const {
    activeListHeader: pullSearchHeader,
    handleMomentumScrollEnd,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    hiddenHeader,
    pullSearchMinHeight
  } = useScrollInit({
    listHeaderComponent: externalListHeaderComponent,
    onMomentumScrollEnd: externalMomentumScrollEnd,
    onRefresh: pullSearchHeight ? onRefresh : undefined,
    onScrollBeginDrag: externalScrollBeginDrag,
    onScrollEndDrag: externalScrollEndDrag,
    pullSearchHeight,
    scrollTo
  })

  const activeListHeader = useMemo(() => {
    if (!renderFilters) return pullSearchHeader
    const Inner = pullSearchHeader
    return () => (
      <>
        {Inner ? typeof Inner === 'function' ? <Inner /> : Inner : null}
        {renderFilters}
      </>
    )
  }, [pullSearchHeader, renderFilters])

  const contentContainerStyle = useMemo(() => (isHorizontal ? externalContentContainerStyle : [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom + pullSearchMinHeight }, externalContentContainerStyle]), [isHorizontal, contentInset.bottom, contentInset.top, externalContentContainerStyle, pullSearchMinHeight])

  const onPullSearchZoneEnter = useCallback(() => {
    if (!pullSearchHeight) return
    scrollView.current?.scrollToOffset({ offset: -contentInset.top + pullSearchHeight, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const handleScroll = useScrollHandler({ chipHidden, chipThreshold, footerFixed, headerFixed, isHorizontal, onPullSearchZoneEnter: pullSearchHeight ? onPullSearchZoneEnter : undefined })

  const handleScrollToTop = useCallback(() => {
    if (isHorizontal) {
      scrollView.current?.scrollToOffset({ offset: 0, animated: true })
      return
    }
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.scrollToOffset({ offset, animated: true })
  }, [isHorizontal, contentInset.top, pullSearchHeight])

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      if (onContentSizeChange) onContentSizeChange(w, h)
    },
    [onContentSizeChange]
  )

  const refreshControl = useMemo(() => <RefreshControl />, [])
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined

  const content = (
    <View style={containerStyle}>
      <Animated.FlatList
        {...(props as Omit<RNFlatListProps<T>, 'CellRendererComponent'>)}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentOffset={contentOffset}
        data={data}
        horizontal={isHorizontal}
        initialNumToRender={initialNumToRender}
        ListHeaderComponent={activeListHeader}
        maxToRenderPerBatch={maxToRenderPerBatch}
        onContentSizeChange={handleContentSizeChange}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        pagingEnabled={pagingEnabled}
        ref={(el: RNFlatList | null) => {
          if (externalRef) externalRef.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
        removeClippedSubviews={removeClippedSubviews}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator ?? isHorizontal}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? !isHorizontal}
        windowSize={windowSize}
      />
      {hiddenHeader && (
        <View pointerEvents='none' style={styles.measureContainer}>
          {hiddenHeader}
        </View>
      )}
      <ScrollViewChip chipProps={chipProps} isHorizontal={isHorizontal} onChipPress={onChipPress} onPress={handleScrollToTop} style={chipStyle} />
      {showDots && <HorizontalDots total={data?.length ?? 0} />}
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = { measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 } }

export const FlatList = memo(FlatListInner) as typeof FlatListInner
