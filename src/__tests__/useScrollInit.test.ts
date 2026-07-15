import { act, renderHook } from '@testing-library/react'
import React from 'react'

import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { useScrollInit } from '../useScrollInit'

const HEADER_HEIGHT = 80
const PULL_SEARCH_HEIGHT = 40
const REMOUNT_SYNC_MAX_ATTEMPTS = 8
const SNAP_VERIFY_MAX_ATTEMPTS = 5
const SNAP_VERIFY_INITIAL_DELAY_MS = 400
const SNAP_VERIFY_RETRY_DELAY_MS = 150

const buildContextValue = (headerHeight: number | null): ScrollViewContextType =>
  ({
    blur: true,
    footerHeight: 0,
    footerHeightShared: { value: 0 },
    footerFixed: false,
    footerOffset: { value: 0 },
    headerHeight,
    headerHeightShared: { value: headerHeight ?? 0 },
    headerFixed: false,
    headerOffset: { value: 0 },
    listGeneration: { value: 0 },
    onListUnmount: jest.fn(),
    progress: null,
    progressing: false,
    pullSearchHeightShared: { value: 0 },
    scrollHeight: 0,
    scrollPosition: { value: 0 },
    setFooterHeight: jest.fn(),
    setHeaderHeight: jest.fn(),
    setProgress: jest.fn(),
    setProgressing: jest.fn(),
    snapBackFooterShared: { value: false },
    snapBackHeaderShared: { value: false },
    tabBarHeight: 60
  }) as unknown as ScrollViewContextType

const renderInit = (headerHeight: number | null, pullSearchHeight?: number) => {
  const contextValue = buildContextValue(headerHeight)
  const scrollTo = jest.fn()
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(ScrollViewContext.Provider, { value: contextValue }, children)
  const rendered = renderHook(() => useScrollInit({ pullSearchHeight, scrollTo }), { wrapper })
  return { ...rendered, contextValue, scrollTo }
}

describe('useScrollInit remount sync', () => {
  it('true first mount (headerHeight null) skips remount-sync and starts ready', () => {
    const { result, unmount } = renderInit(null)
    expect(result.current.scrollReady).toBe(true)
    expect(result.current.remountSyncTarget.value).toBeNull()
    unmount()
  })

  it('remount (headerHeight already known at mount) hides the list and targets showY', () => {
    const { result, scrollTo, unmount } = renderInit(HEADER_HEIGHT)
    expect(result.current.scrollReady).toBe(false)
    expect(result.current.remountSyncTarget.value).toBe(-HEADER_HEIGHT)
    // Primes a corrective scrollTo immediately, rather than assuming native honored the initial contentOffset.
    expect(scrollTo).toHaveBeenCalledWith(-HEADER_HEIGHT, false)
    unmount()
  })

  it('remount with pullSearchHeight targets hideY directly (skips the 2-phase first-mount dance)', () => {
    const { result, unmount } = renderInit(HEADER_HEIGHT, 40)
    expect(result.current.remountSyncTarget.value).toBe(-HEADER_HEIGHT + 40)
    unmount()
  })

  it('retries the corrective scrollTo when an onScroll event reports the wrong position, and stays hidden', () => {
    const { result, scrollTo, unmount } = renderInit(HEADER_HEIGHT)
    scrollTo.mockClear()
    act(() => {
      result.current.onRemountSyncRetry(0) // a spurious post-remount event reporting y=0
    })
    expect(scrollTo).toHaveBeenCalledWith(-HEADER_HEIGHT, false)
    expect(result.current.scrollReady).toBe(false)
    unmount()
  })

  it('reveals once a confirmed on-target event arrives', () => {
    const { result, contextValue, unmount } = renderInit(HEADER_HEIGHT)
    act(() => {
      result.current.onRemountSynced(-HEADER_HEIGHT)
    })
    expect(result.current.scrollReady).toBe(true)
    expect(contextValue.scrollPosition.value).toBe(-HEADER_HEIGHT)
    unmount()
  })

  it('gives up and reveals anyway after exceeding the max retry attempts, rather than hiding forever', () => {
    const { result, unmount } = renderInit(HEADER_HEIGHT)
    act(() => {
      for (let i = 0; i < REMOUNT_SYNC_MAX_ATTEMPTS + 2; i += 1) result.current.onRemountSyncRetry(0)
    })
    expect(result.current.scrollReady).toBe(true)
    expect(result.current.remountSyncTarget.value).toBeNull()
    unmount()
  })
})

const dragEvent = (y: number) => ({ nativeEvent: { contentOffset: { y } } }) as never

// A true first mount (not a remount): headerHeight starts null, then a rerender simulates the
// header's async measurement landing, mirroring the real production flow. Using a non-null
// headerHeight from the start (like the remount-sync tests above) would make useScrollInit treat
// this as a remount and pull in unrelated machinery — the priming scrollTo, the 40-frame RAF
// oscillation, and the REMOUNT_SYNC_FALLBACK_MS timer — none of which is relevant to the pull-search
// snap logic under test here.
const renderPullSearchInit = (pullSearchHeight: number) => {
  const scrollTo = jest.fn()
  let contextValue = buildContextValue(null)
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(ScrollViewContext.Provider, { value: contextValue }, children)
  const rendered = renderHook(() => useScrollInit({ pullSearchHeight, scrollTo }), { wrapper })
  act(() => {
    contextValue = buildContextValue(HEADER_HEIGHT)
    rendered.rerender()
  })
  scrollTo.mockClear() // drop Effect A's insurance call and Effect B's showY->hideY push
  return { ...rendered, contextValue, scrollTo }
}

describe('useScrollInit pull-search snap', () => {
  const showY = -HEADER_HEIGHT
  const hideY = -HEADER_HEIGHT + PULL_SEARCH_HEIGHT

  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('opens toward showY when dragged down past half the pull-search height', () => {
    const { result, scrollTo, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(hideY))
      result.current.handleScrollEndDrag(dragEvent(showY))
    })
    expect(scrollTo).toHaveBeenCalledWith(showY, true)
    unmount()
  })

  it('closes toward hideY when released without pulling past the half threshold', () => {
    const { result, scrollTo, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(hideY))
      result.current.handleScrollEndDrag(dragEvent(hideY - 10))
    })
    expect(scrollTo).toHaveBeenCalledWith(hideY, true)
    unmount()
  })

  it('does nothing when the release lands outside the pull-search zone entirely', () => {
    const { result, scrollTo, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(0))
      result.current.handleScrollEndDrag(dragEvent(0))
    })
    expect(scrollTo).not.toHaveBeenCalled()
    unmount()
  })

  it('keeps retrying (non-animated) until scrollPosition actually confirms the target, then stops', () => {
    const { result, scrollTo, contextValue, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    contextValue.scrollPosition.value = hideY
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(hideY))
      result.current.handleScrollEndDrag(dragEvent(showY))
    })
    expect(scrollTo).toHaveBeenCalledTimes(1) // the initial animated call

    act(() => {
      jest.advanceTimersByTime(SNAP_VERIFY_INITIAL_DELAY_MS)
    })
    expect(scrollTo).toHaveBeenLastCalledWith(showY, false) // first non-animated retry, still short of target

    // The retry "lands" — simulate onScroll confirming the real position.
    contextValue.scrollPosition.value = showY
    act(() => {
      jest.advanceTimersByTime(SNAP_VERIFY_RETRY_DELAY_MS)
    })
    scrollTo.mockClear()
    act(() => {
      jest.advanceTimersByTime(SNAP_VERIFY_RETRY_DELAY_MS * 5)
    })
    expect(scrollTo).not.toHaveBeenCalled() // verification stopped once confirmed
    unmount()
  })

  it('gives up after exceeding the max retry attempts rather than retrying forever', () => {
    const { result, scrollTo, contextValue, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    contextValue.scrollPosition.value = hideY // never reaches showY, no matter how many retries
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(hideY))
      result.current.handleScrollEndDrag(dragEvent(showY))
    })
    act(() => {
      jest.advanceTimersByTime(SNAP_VERIFY_INITIAL_DELAY_MS + SNAP_VERIFY_RETRY_DELAY_MS * (SNAP_VERIFY_MAX_ATTEMPTS + 1))
    })
    // 1 initial animated call + SNAP_VERIFY_MAX_ATTEMPTS non-animated retries, then it gives up.
    expect(scrollTo).toHaveBeenCalledTimes(1 + SNAP_VERIFY_MAX_ATTEMPTS)

    scrollTo.mockClear()
    act(() => {
      jest.advanceTimersByTime(SNAP_VERIFY_RETRY_DELAY_MS * 3)
    })
    expect(scrollTo).not.toHaveBeenCalled()
    unmount()
  })

  it('cancels a pending verification when a new drag begins', () => {
    const { result, scrollTo, contextValue, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    contextValue.scrollPosition.value = hideY
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(hideY))
      result.current.handleScrollEndDrag(dragEvent(showY))
    })
    scrollTo.mockClear()
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(showY))
    })
    act(() => {
      jest.advanceTimersByTime(SNAP_VERIFY_INITIAL_DELAY_MS * 3)
    })
    expect(scrollTo).not.toHaveBeenCalled()
    unmount()
  })

  it('handleMomentumScrollEnd auto-closes when momentum alone carried it into the zone with no drag-committed target', () => {
    const { result, scrollTo, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    act(() => {
      result.current.handleMomentumScrollEnd(dragEvent(hideY - 10))
    })
    expect(scrollTo).toHaveBeenCalledWith(hideY, true)
    unmount()
  })

  it('handleMomentumScrollEnd defers to an already-pending drag-committed target instead of double-correcting', () => {
    const { result, scrollTo, contextValue, unmount } = renderPullSearchInit(PULL_SEARCH_HEIGHT)
    contextValue.scrollPosition.value = hideY
    act(() => {
      result.current.handleScrollBeginDrag(dragEvent(hideY))
      result.current.handleScrollEndDrag(dragEvent(showY))
    })
    scrollTo.mockClear()
    act(() => {
      result.current.handleMomentumScrollEnd(dragEvent(hideY - 10))
    })
    expect(scrollTo).not.toHaveBeenCalled()
    unmount()
  })
})
