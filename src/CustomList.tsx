import { type ComponentType, memo, type ReactElement, type ReactNode, type RefObject, useCallback, useMemo, useRef } from 'react'
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'

import { RefreshControl } from './internal/RefreshControl'
import { ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
import { useScrollInit } from './useScrollInit'

type ScrollToOffsetRef = { scrollToOffset: (params: { animated?: boolean; offset: number }) => void }

export type CustomListProps<P extends object> = Omit<P, 'contentInset' | 'contentOffset' | 'onScroll' | 'refreshControl' | 'scrollEventThrottle'> & {
  component: ComponentType<P>
  renderFilters?: ReactNode
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRefresh?: () => Promise<void> | void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  scrollRef?: RefObject<ScrollToOffsetRef | null>
  style?: StyleProp<ViewStyle>
}

const CustomListInner = <P extends object>({ component: List, renderFilters, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, scrollRef, style, ...props }: CustomListProps<P>) => {
  // Intercept ListHeaderComponent so useScrollInit can apply the same 2-phase measurement as FlatList.
  const { ListHeaderComponent: listHeaderComponent, contentContainerStyle: externalContentContainerStyle, ...restProps } = props as Record<string, unknown>

  const { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, keyboardAware, pullSearchHeight, style })

  const scrollViewInternal = useRef<ScrollToOffsetRef | null>(null)

  const handleRef = useCallback(
    (el: ScrollToOffsetRef | null) => {
      scrollViewInternal.current = el
      if (scrollRef) scrollRef.current = el
    },
    [scrollRef]
  )

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollViewInternal.current?.scrollToOffset({ offset, animated })
  }, [])

  const {
    activeListHeader: pullSearchHeader,
    handleMomentumScrollEnd,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    hiddenHeader,
    pullSearchMinHeight
  } = useScrollInit({
    listHeaderComponent: listHeaderComponent as ComponentType<object> | ReactElement | null | undefined,
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

  const contentContainerStyle = useMemo(() => [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom + pullSearchMinHeight }, externalContentContainerStyle], [contentInset.bottom, contentInset.top, externalContentContainerStyle, pullSearchMinHeight])

  const onPullSearchZoneEnter = useCallback(() => {
    if (!pullSearchHeight) return
    scrollViewInternal.current?.scrollToOffset({ offset: -contentInset.top + pullSearchHeight, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const onScroll = useScrollHandler({ chipHidden, footerFixed, headerFixed, onPullSearchZoneEnter: pullSearchHeight ? onPullSearchZoneEnter : undefined })

  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollViewInternal.current?.scrollToOffset({ offset, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const refreshControl = useMemo(() => <RefreshControl />, [])
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined

  const TypedList = List as ComponentType<{
    contentContainerStyle?: unknown
    contentInset: typeof contentInset
    contentOffset: typeof contentOffset
    ListHeaderComponent?: unknown
    onMomentumScrollEnd: typeof handleMomentumScrollEnd
    onScroll: typeof onScroll
    onScrollBeginDrag: typeof handleScrollBeginDrag
    onScrollEndDrag: typeof handleScrollEndDrag
    ref?: ((el: ScrollToOffsetRef | null) => void) | RefObject<ScrollToOffsetRef | null>
    refreshControl: ReactElement
    scrollEventThrottle: 16
    [key: string]: unknown
  }>

  const content = (
    <View style={containerStyle}>
      <TypedList {...restProps} contentContainerStyle={contentContainerStyle} contentInset={contentInset} contentOffset={contentOffset} ListHeaderComponent={activeListHeader} onMomentumScrollEnd={handleMomentumScrollEnd} onScroll={onScroll} onScrollBeginDrag={handleScrollBeginDrag} onScrollEndDrag={handleScrollEndDrag} ref={handleRef} refreshControl={refreshControl} scrollEventThrottle={16} />
      {hiddenHeader && (
        <View pointerEvents='none' style={styles.measureContainer}>
          {hiddenHeader}
        </View>
      )}
      <ScrollViewChip onPress={handleScrollToTop} style={chipStyle} />
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = { measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 } }

export const CustomList = memo(CustomListInner) as typeof CustomListInner
