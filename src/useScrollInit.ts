import { type ComponentType, createElement, type ReactElement, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { ScrollViewContext } from './ScrollViewContext'

export type UseScrollInitOptions = {
  listHeaderComponent?: ComponentType<any> | ReactElement | null
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRefresh?: () => Promise<void> | void
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  scrollTo: (offset: number, animated: boolean) => void
}

export type UseScrollInitResult = {
  activeListHeader: ComponentType<any> | ReactElement | null | undefined
  handleMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  hiddenHeader: ReactElement | null
  pullSearchMinHeight: number
}

export function useScrollInit({ listHeaderComponent, onMomentumScrollEnd: externalMomentumScrollEnd, onRefresh, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, scrollTo }: UseScrollInitOptions): UseScrollInitResult {
  const { headerHeight, scrollPosition, setProgressing } = useContext(ScrollViewContext)
  const hasPullSearch = pullSearchHeight !== undefined
  const [phase, setPhase] = useState<'measuring' | 'ready'>(hasPullSearch ? 'measuring' : 'ready')
  const [refreshing, setRefreshing] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const deliberatelyOpened = useRef(false)

  // Transition to 'ready' once both measurements are available
  useEffect(() => {
    if (phase === 'ready' || !headerHeight || !pullSearchHeight) return
    scrollPosition.value = -headerHeight + pullSearchHeight
    setPhase('ready')
  }, [phase, headerHeight, pullSearchHeight, scrollPosition])

  // Effect A: scroll to natural top the first time headerHeight is measured
  const headerInitialized = useRef(false)
  useLayoutEffect(() => {
    if (!headerHeight || headerInitialized.current) return
    headerInitialized.current = true
    scrollPosition.value = -headerHeight
    scrollTo(-headerHeight, false)
  }, [headerHeight, scrollPosition, scrollTo])

  // Effect B: scroll to hideY when pullSearch phase is ready (same Fabric commit as ListHeaderComponent addition)
  const pullSearchInitialized = useRef(false)
  useLayoutEffect(() => {
    if (!hasPullSearch || phase !== 'ready' || pullSearchInitialized.current || !headerHeight || !pullSearchHeight) return
    pullSearchInitialized.current = true
    scrollPosition.value = -headerHeight + pullSearchHeight
    scrollTo(-headerHeight + pullSearchHeight, false)
  }, [hasPullSearch, phase, headerHeight, pullSearchHeight, scrollPosition, scrollTo])

  useEffect(() => {
    if (pullSearchHeight) setProgressing(refreshing)
  }, [pullSearchHeight, refreshing, setProgressing])

  const handleScrollBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      deliberatelyOpened.current = false
      if (pullSearchHeight) dragStartY.current = e.nativeEvent.contentOffset.y
      externalScrollBeginDrag?.(e)
    },
    [externalScrollBeginDrag, pullSearchHeight]
  )

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pullSearchHeight && headerHeight) {
        const y = e.nativeEvent.contentOffset.y
        const showY = -headerHeight
        const hideY = -headerHeight + pullSearchHeight
        const pulledDown = (dragStartY.current ?? hideY) <= hideY
        dragStartY.current = null
        if (pulledDown && y <= showY + pullSearchHeight * 0.5) {
          deliberatelyOpened.current = true
          if (y <= showY && !refreshing && onRefresh) {
            setRefreshing(true)
            Promise.resolve(onRefresh()).finally(() => setRefreshing(false))
          }
          scrollTo(showY, true)
        } else if (y < hideY) {
          scrollTo(hideY, true)
        }
      }
      externalScrollEndDrag?.(e)
    },
    [externalScrollEndDrag, headerHeight, onRefresh, pullSearchHeight, refreshing, scrollTo]
  )

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pullSearchHeight && headerHeight && !deliberatelyOpened.current && !refreshing) {
        const y = e.nativeEvent.contentOffset.y
        const hideY = -headerHeight + pullSearchHeight
        if (y < hideY - 1) scrollTo(hideY, true)
      }
      deliberatelyOpened.current = false
      externalMomentumScrollEnd?.(e)
    },
    [externalMomentumScrollEnd, headerHeight, pullSearchHeight, refreshing, scrollTo]
  )

  const activeListHeader = hasPullSearch && phase === 'measuring' ? null : listHeaderComponent
  const hiddenHeader = phase === 'measuring' && listHeaderComponent != null ? (typeof listHeaderComponent === 'function' ? createElement(listHeaderComponent as ComponentType) : (listHeaderComponent as ReactElement)) : null

  return { activeListHeader, handleMomentumScrollEnd, handleScrollBeginDrag, handleScrollEndDrag, hiddenHeader, pullSearchMinHeight: pullSearchHeight ?? 0 }
}
