import { createElement, type ComponentType, type ReactElement, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { ScrollViewContext } from './ScrollViewContext'

export type UseScrollInitOptions = {
  listHeaderComponent?: ComponentType<any> | ReactElement | null
  onScrollBeginDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  pullSearchHeight?: number
  scrollTo: (offset: number, animated: boolean) => void
}

export type UseScrollInitResult = {
  activeListHeader: ComponentType<any> | ReactElement | null | undefined
  handleScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  hiddenHeader: ReactElement | null
  pullSearchMinHeight: number
}

export function useScrollInit({ listHeaderComponent, onScrollBeginDrag: externalScrollBeginDrag, onScrollEndDrag: externalScrollEndDrag, pullSearchHeight, scrollTo }: UseScrollInitOptions): UseScrollInitResult {
  const { headerHeight, scrollPosition } = useContext(ScrollViewContext)
  const hasPullSearch = pullSearchHeight !== undefined
  const [phase, setPhase] = useState<'measuring' | 'ready'>(hasPullSearch ? 'measuring' : 'ready')
  const dragStartY = useRef<number | null>(null)

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

  const handleScrollBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
          scrollTo(showY, true)
        } else if (y < hideY) {
          scrollTo(hideY, true)
        }
      }
      externalScrollEndDrag?.(e)
    },
    [externalScrollEndDrag, headerHeight, pullSearchHeight, scrollTo]
  )

  const activeListHeader = hasPullSearch && phase === 'measuring' ? null : listHeaderComponent
  const hiddenHeader =
    phase === 'measuring' && listHeaderComponent != null
      ? typeof listHeaderComponent === 'function'
        ? createElement(listHeaderComponent as ComponentType)
        : (listHeaderComponent as ReactElement)
      : null

  return { activeListHeader, handleScrollBeginDrag, handleScrollEndDrag, hiddenHeader, pullSearchMinHeight: pullSearchHeight ?? 0 }
}
