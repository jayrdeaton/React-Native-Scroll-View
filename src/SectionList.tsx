import { memo, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, SectionList as RNSectionList, type SectionListProps as RNSectionListProps, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, { createAnimatedComponent } from 'react-native-reanimated'

import { RefreshControl } from './internal/RefreshControl'
import { type ChipProps, ScrollViewChip } from './internal/ScrollViewChip'
import { useScrollHandler } from './internal/useScrollHandler'
import { useScrollList } from './internal/useScrollList'
import { useStickyHeaders } from './internal/useStickyHeaders'
import { useScrollInit } from './useScrollInit'

const AnimatedSectionList = createAnimatedComponent(RNSectionList) as unknown as typeof RNSectionList

export type SectionListProps<ItemT, SectionT extends { data: ReadonlyArray<ItemT> } = { data: ReadonlyArray<ItemT> }> = Omit<RNSectionListProps<ItemT, SectionT>, 'horizontal'> & {
  chipProps?: ChipProps
  chipThreshold?: number
  renderFilters?: ReactNode
  footerFixed?: boolean
  gesture?: GestureType
  headerFixed?: boolean
  keyboardAware?: boolean
  onChipPress?: () => void
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  ref?: RefObject<RNSectionList<ItemT, SectionT> | null>
}

const SectionListInner = <ItemT, SectionT extends { data: ReadonlyArray<ItemT> } = { data: ReadonlyArray<ItemT> }>({ chipProps, chipThreshold, contentContainerStyle: externalContentContainerStyle, initialNumToRender = 20, maxToRenderPerBatch = 50, renderFilters, footerFixed: footerFixedProp, gesture, headerFixed: headerFixedProp, keyboardAware, ListHeaderComponent: externalListHeaderComponent, onChipPress, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onContentSizeChange, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, refreshing, removeClippedSubviews = false, sections, showsVerticalScrollIndicator, style, ref: externalRef, windowSize = 100, ...props }: SectionListProps<ItemT, SectionT>) => {
  const scrollView = useRef<RNSectionList<ItemT, SectionT>>(null)

  const { stickySectionHeadersEnabled = true, renderSectionHeader, ...passThroughProps } = props as RNSectionListProps<ItemT, SectionT>

  const { chipHidden, chipStyle, containerStyle, contentInset, contentOffset, footerFixed, headerFixed, headerHeight } = useScrollList({ footerFixed: footerFixedProp, headerFixed: headerFixedProp, keyboardAware, pullSearchHeight, style })

  const usesCustomSticky = stickySectionHeadersEnabled && renderSectionHeader != null
  const { activeIndex, clipStyle, measureHeader, overlayStyle, resetPositions } = useStickyHeaders(headerFixed, usesCustomSticky)

  // useLayoutEffect (not useEffect) so the reset runs before native layout fires onLayout
  // for the newly mounted section headers — otherwise the reset would clear correct positions.
  useLayoutEffect(() => {
    if (usesCustomSticky) resetPositions(sections.length)
  }, [sections, usesCustomSticky, resetPositions, headerHeight])

  // Per-section view refs so we can call view.measure() for window-coordinate Y.
  const sectionViewRefs = useRef<Map<number, View | null>>(new Map())

  const wrappedRenderSectionHeader = useMemo(() => {
    if (!usesCustomSticky) return renderSectionHeader ?? undefined
    return (info: { section: SectionT }) => {
      const idx = sections.findIndex((s) => s === info.section)
      return (
        <View
          ref={(el: View | null) => {
            sectionViewRefs.current.set(idx, el)
          }}
          onLayout={() => {
            const el = sectionViewRefs.current.get(idx)
            el?.measure((_x, _y, _w, h, _px, pageY) => {
              // Guard against stale callbacks from unmounted views (e.g. after key remount)
              if (idx >= 0 && sectionViewRefs.current.get(idx) === el) measureHeader(idx, pageY, h)
            })
          }}
        >
          {renderSectionHeader(info)}
        </View>
      )
    }
  }, [usesCustomSticky, renderSectionHeader, sections, measureHeader])

  const scrollTo = useCallback((offset: number, animated: boolean) => {
    scrollView.current?.getScrollResponder()?.scrollTo({ y: offset, animated })
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

  // When PullSearch is first added to the list, onLayout doesn't re-fire for already-visible
  // section headers (their frame relative to their direct parent is unchanged). Re-measure them
  // once after the layout settles so positions account for the PullSearch height offset.
  const pullSearchSettled = useRef(false)
  useEffect(() => {
    if (!usesCustomSticky || activeListHeader == null || pullSearchSettled.current) return
    pullSearchSettled.current = true
    const handle = requestAnimationFrame(() => {
      sectionViewRefs.current.forEach((el, idx) => {
        el?.measure((_x, _y, _w, h, _px, pageY) => {
          if (sectionViewRefs.current.get(idx) === el) measureHeader(idx, pageY, h)
        })
      })
    })
    return () => cancelAnimationFrame(handle)
  }, [activeListHeader, usesCustomSticky, measureHeader])

  const contentContainerStyle = useMemo(() => [{ minHeight: Dimensions.get('window').height - contentInset.top - contentInset.bottom + pullSearchMinHeight }, externalContentContainerStyle], [contentInset.bottom, contentInset.top, externalContentContainerStyle, pullSearchMinHeight])

  const onPullSearchZoneEnter = useCallback(() => {
    if (!pullSearchHeight) return
    scrollTo(-contentInset.top + pullSearchHeight, true)
  }, [contentInset.top, pullSearchHeight, scrollTo])

  const handleScroll = useScrollHandler({ chipHidden, chipThreshold, footerFixed, headerFixed, onPullSearchZoneEnter: pullSearchHeight ? onPullSearchZoneEnter : undefined })

  const handleScrollToTop = useCallback(() => {
    const offset = pullSearchHeight ? -contentInset.top + pullSearchHeight : -contentInset.top
    scrollView.current?.getScrollResponder()?.scrollTo({ y: offset, animated: true })
  }, [contentInset.top, pullSearchHeight])

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      if (onContentSizeChange) onContentSizeChange(w, h)
    },
    [onContentSizeChange]
  )

  const refreshControl = useMemo(() => (onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} /> : <RefreshControl />), [onRefresh, refreshing])
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const combinedGesture = useMemo(() => (gesture !== undefined ? Gesture.Simultaneous(gesture, nativeGesture) : nativeGesture), [gesture, nativeGesture])
  const detectorGesture = gesture !== undefined ? combinedGesture : undefined

  const content = (
    <View style={containerStyle}>
      <AnimatedSectionList
        key={headerHeight > 0 ? 1 : 0}
        {...passThroughProps}
        contentContainerStyle={contentContainerStyle}
        contentInset={contentInset}
        contentOffset={contentOffset}
        initialNumToRender={initialNumToRender}
        ListHeaderComponent={activeListHeader}
        maxToRenderPerBatch={maxToRenderPerBatch}
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
        removeClippedSubviews={removeClippedSubviews}
        renderSectionHeader={wrappedRenderSectionHeader}
        scrollEventThrottle={16}
        sections={sections}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? true}
        stickySectionHeadersEnabled={false}
        windowSize={windowSize}
      />
      {hiddenHeader && (
        <View pointerEvents='none' style={styles.measureContainer}>
          {hiddenHeader}
        </View>
      )}
      <ScrollViewChip chipProps={chipProps} onChipPress={onChipPress} onPress={handleScrollToTop} style={chipStyle} />
      {usesCustomSticky && (
        <Animated.View pointerEvents='none' style={[styles.stickyClip, clipStyle]}>
          {activeIndex >= 0 && activeIndex < sections.length && <Animated.View style={[styles.stickyOverlay, overlayStyle]}>{renderSectionHeader({ section: sections[activeIndex] })}</Animated.View>}
        </Animated.View>
      )}
    </View>
  )
  return detectorGesture ? <GestureDetector gesture={detectorGesture}>{content}</GestureDetector> : content
}

const styles = {
  measureContainer: { left: 0, opacity: 0, position: 'absolute' as const, right: 0, top: -9999 },
  stickyClip: { bottom: 0, left: 0, overflow: 'hidden' as const, position: 'absolute' as const, right: 0, zIndex: 2 },
  stickyOverlay: { left: 0, position: 'absolute' as const, right: 0 }
}

export const SectionList = memo(SectionListInner) as typeof SectionListInner
