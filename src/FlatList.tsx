import { Fragment, memo, type ReactNode, type RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react'
import { Dimensions, FlatList as RNFlatList, type FlatListProps as RNFlatListProps, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'

import { HorizontalDots } from './internal/HorizontalDots'
import { RefreshControl } from './internal/RefreshControl'
import { type ChipProps, ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandlerJS } from './internal/useScrollHandlerJS'
import { useScrollList } from './internal/useScrollList'
import { ScrollViewContext } from './ScrollViewContext'
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

const FlatListInner = <T,>({ chipProps, chipThreshold, columnWrapperStyle, contentContainerStyle: externalContentContainerStyle, data, initialNumToRender = 20, keyExtractor, maxToRenderPerBatch = 50, numColumns, renderFilters, renderItem, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, horizontal, keyboardAware, ListHeaderComponent: externalListHeaderComponent, onChipPress, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pagingEnabled, pullSearchHeight, removeClippedSubviews = false, showsHorizontalScrollIndicator, showsVerticalScrollIndicator, style, onContentSizeChange, ref: externalRef, windowSize = 100, ...props }: FlatListProps<T>) => {
  // Plain (non-Animated) FlatList: react-native-reanimated's Animated.FlatList does not reliably
  // honor the initial `contentOffset` prop on a key-forced remount — the header/list can briefly
  // render at the wrong position. A plain FlatList honors it correctly, so scroll position is driven
  // by a regular JS onScroll callback (useScrollHandlerJS) instead of a Reanimated worklet — which
  // also avoids the "WorkletEventHandler" crash that a worklet handler triggers when attached to a
  // non-Animated component.
  const scrollView = useRef<RNFlatList<T>>(null)
  const isHorizontal = horizontal === true
  const showDots = isHorizontal && pagingEnabled === true && (data?.length ?? 0) > 1

  // RN's own FlatList implements numColumns by chunking `data` into rows internally, but throws if
  // numColumns ever changes without the caller changing `key` to force a full remount. On iOS,
  // Fabric pools/recycles native ScrollView instances by component type across such a remount, and
  // the recycled instance's onScroll can silently stop firing for the new React instance entirely —
  // a native event-routing issue, not something a JS-side retry loop can detect or correct. Doing
  // the row-chunking ourselves here and always passing numColumns={1} through to the underlying
  // RNFlatList means numColumns never "changes" from RN's perspective — only `data`/`renderItem`
  // change, which RNFlatList treats as an ordinary prop update with no remount at all, so callers
  // can toggle numColumns freely (e.g. switching a list to a grid) without ever hitting this class
  // of bug.
  const cols = numColumns && numColumns > 1 ? numColumns : 1
  const rowData = useMemo(() => {
    if (cols <= 1 || !data) return data
    const items = Array.from(data)
    const rows: T[][] = []
    for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
    return rows as unknown as readonly T[]
  }, [cols, data])
  const rowKeyExtractor = useCallback(
    (row: T | T[], rowIndex: number) => {
      if (cols <= 1) return keyExtractor ? keyExtractor(row as T, rowIndex) : defaultKeyExtractor(row as T, rowIndex)
      return (row as T[]).map((item, kk) => (keyExtractor ? keyExtractor(item, rowIndex * cols + kk) : defaultKeyExtractor(item, rowIndex * cols + kk))).join(':')
    },
    [cols, keyExtractor]
  )
  const rowRenderItem = useCallback<ListRenderItem<T>>(
    (info) => {
      if (cols <= 1) return renderItem ? renderItem(info) : null
      const row = info.item as unknown as T[]
      return (
        <View style={[styles.row, columnWrapperStyle] as StyleProp<ViewStyle>}>
          {row.map((item, kk) => (
            <Fragment key={kk}>{renderItem ? renderItem({ index: info.index * cols + kk, item, separators: info.separators }) : null}</Fragment>
          ))}
        </View>
      )
    },
    [cols, columnWrapperStyle, renderItem]
  )

  const { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, isHorizontal, keyboardAware, pullSearchHeight, style })
  const { jsListGeneration, onJsListUnmount } = useContext(ScrollViewContext)
  // Plain ref, not a SharedValue: see the comment on ScrollViewContextType.jsListGeneration for why.
  const capturedGeneration = useRef(jsListGeneration.current)
  useLayoutEffect(() => {
    capturedGeneration.current = jsListGeneration.current
  }, [jsListGeneration])
  useLayoutEffect(() => () => onJsListUnmount(), [onJsListUnmount])

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.scrollToOffset({ offset, animated })
  }, [])

  const {
    activeListHeader: pullSearchHeader,
    handleMomentumScrollEnd,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    hiddenHeader,
    pullSearchMinHeight,
    remountTarget
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

  const scrollHandler = useScrollHandlerJS({ capturedGeneration, chipHidden, chipThreshold, footerFixed, headerFixed, isHorizontal, jsListGeneration, remountTarget, scrollTo })

  const onScrollBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollHandler.onScrollBeginDrag(e)
      handleScrollBeginDrag(e)
    },
    [scrollHandler, handleScrollBeginDrag]
  )

  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollHandler.onScrollEndDrag(e)
      handleScrollEndDrag(e)
    },
    [scrollHandler, handleScrollEndDrag]
  )

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollHandler.onMomentumScrollEnd(e)
      handleMomentumScrollEnd(e)
    },
    [scrollHandler, handleMomentumScrollEnd]
  )

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
      <RNFlatList
        {...(props as Omit<RNFlatListProps<T>, 'CellRendererComponent'>)}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentInsetAdjustmentBehavior='never'
        contentOffset={contentOffset}
        data={cols > 1 ? rowData : data}
        horizontal={isHorizontal}
        initialNumToRender={initialNumToRender}
        keyExtractor={cols > 1 ? rowKeyExtractor : keyExtractor}
        ListHeaderComponent={activeListHeader}
        maxToRenderPerBatch={maxToRenderPerBatch}
        onContentSizeChange={handleContentSizeChange}
        onMomentumScrollBegin={scrollHandler.onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={scrollHandler.onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        pagingEnabled={pagingEnabled}
        renderItem={cols > 1 ? rowRenderItem : renderItem}
        ref={(el: RNFlatList<T> | null) => {
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

const defaultKeyExtractor = <T,>(item: T, index: number): string => {
  const key = (item as { id?: string; key?: string } | null)?.key ?? (item as { id?: string; key?: string } | null)?.id
  return key != null ? String(key) : String(index)
}

const styles = { measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 }, row: { flexDirection: 'row' as const } }

export const FlatList = memo(FlatListInner) as typeof FlatListInner
