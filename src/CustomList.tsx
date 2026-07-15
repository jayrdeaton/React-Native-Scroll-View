import { type ComponentType, memo, type ReactElement, type ReactNode, type RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react'
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { runOnUI, useSharedValue } from 'react-native-reanimated'

import { RefreshControl } from './internal/RefreshControl'
import { type ChipProps, ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
import { ScrollViewContext } from './ScrollViewContext'
import { useScrollInit } from './useScrollInit'

type ScrollToOffsetRef = { scrollToOffset: (params: { animated?: boolean; offset: number }) => void }

export type CustomListProps<P extends object> = Omit<P, 'contentInset' | 'contentOffset' | 'onScroll' | 'refreshControl' | 'scrollEventThrottle'> & {
  chipProps?: ChipProps
  chipThreshold?: number
  component: ComponentType<P>
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
  scrollRef?: RefObject<ScrollToOffsetRef | null>
  style?: StyleProp<ViewStyle>
}

const CustomListInner = <P extends object>({ chipProps, chipThreshold, component: List, renderFilters, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, onChipPress, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, scrollRef, style, ...props }: CustomListProps<P>) => {
  // Intercept ListHeaderComponent so useScrollInit can apply the same 2-phase measurement as FlatList.
  const { ListHeaderComponent: listHeaderComponent, contentContainerStyle: externalContentContainerStyle, ...restProps } = props as Record<string, unknown>

  const { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, keyboardAware, pullSearchHeight, style })
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
    onRemountSyncRetry,
    onRemountSynced,
    pullSearchMinHeight,
    remountSyncTarget
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

  const onScroll = useScrollHandler({ capturedGeneration, chipHidden, chipThreshold, footerFixed, headerFixed, listGeneration, onRemountSyncRetry, onRemountSynced, remountSyncTarget })

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
      <ScrollViewChip chipProps={chipProps} onChipPress={onChipPress} onPress={handleScrollToTop} style={chipStyle} />
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = { measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 } }

export const CustomList = memo(CustomListInner) as typeof CustomListInner
