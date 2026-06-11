import { memo, type RefObject, useCallback, useMemo, useRef } from 'react'
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, SectionList as RNSectionList, type SectionListProps as RNSectionListProps, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { createAnimatedComponent } from 'react-native-reanimated'

import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
import { useScrollInit } from './useScrollInit'

const AnimatedSectionList = createAnimatedComponent(RNSectionList) as unknown as typeof RNSectionList

export type SectionListProps<ItemT, SectionT extends { data: ReadonlyArray<ItemT> } = { data: ReadonlyArray<ItemT> }> = RNSectionListProps<ItemT, SectionT> & {
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNSectionList<ItemT, SectionT> | null>
}

const SectionListInner = <ItemT, SectionT extends { data: ReadonlyArray<ItemT> } = { data: ReadonlyArray<ItemT> }>({ contentContainerStyle: externalContentContainerStyle, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, ListHeaderComponent: externalListHeaderComponent, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onContentSizeChange, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, sections, style, ref: externalRef, ...props }: SectionListProps<ItemT, SectionT>) => {
  const scrollView = useRef<RNSectionList<ItemT, SectionT>>(null)

  const { chipAnimatedProps, chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed, headerHeight } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, keyboardAware, pullSearchHeight, style })

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.getScrollResponder()?.scrollTo({ y: offset, animated })
  }, [])

  const { activeListHeader, handleMomentumScrollEnd, handleScrollBeginDrag, handleScrollEndDrag, hiddenHeader, pullSearchMinHeight } = useScrollInit({
    listHeaderComponent: externalListHeaderComponent,
    onMomentumScrollEnd: externalMomentumScrollEnd,
    onScrollBeginDrag: externalScrollBeginDrag,
    onScrollEndDrag: externalScrollEndDrag,
    pullSearchHeight,
    scrollTo,
  })

  const contentContainerStyle = useMemo(
    () => [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom + pullSearchMinHeight }, externalContentContainerStyle],
    [contentInset.bottom, contentInset.top, externalContentContainerStyle, pullSearchMinHeight]
  )

  const onPullSearchZoneEnter = useCallback(() => {
    if (!pullSearchHeight) return
    scrollTo(-contentInset.top + pullSearchHeight, true)
  }, [contentInset.top, pullSearchHeight, scrollTo])

  const handleScroll = useScrollHandler({ chipHidden, footerFixed, headerFixed, onPullSearchZoneEnter: pullSearchHeight ? onPullSearchZoneEnter : undefined })

  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.getScrollResponder()?.scrollTo({ y: offset, animated: true })
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
      <AnimatedSectionList
        key={headerHeight > 0 ? 1 : 0}
        {...(props as any)}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentOffset={contentOffset}
        initialNumToRender={20}
        ListHeaderComponent={activeListHeader}
        maxToRenderPerBatch={50}
        onContentSizeChange={handleContentSizeChange}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        ref={(el: RNSectionList<ItemT, SectionT> | null) => {
          if (externalRef) externalRef.current = el
          scrollView.current = el
        }}
        refreshControl={refreshControl}
        removeClippedSubviews={false}
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
      <ScrollViewChip animatedProps={chipAnimatedProps} onPress={handleScrollToTop} style={chipStyle} />
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = { measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 } }

export const SectionList = memo(SectionListInner) as typeof SectionListInner
