import { renderHook } from '@testing-library/react'
import React from 'react'
import type { SharedValue } from 'react-native-reanimated'

import { useScrollHandler } from '../internal/useScrollHandler'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'

// The real reanimated types describe useAnimatedScrollHandler's return value as an opaque
// ScrollHandlerProcessed with no callable surface — the mock's actual runtime shape (a callable
// dispatch function with the handler map's worklets attached as properties, see
// src/__mocks__/react-native-reanimated.ts) has to be asserted explicitly.
type MockedScrollHandler = ((event: ReturnType<typeof scrollEvent>) => void) & {
  onBeginDrag: () => void
  onEndDrag: (event: ReturnType<typeof scrollEvent>) => void
  onMomentumEnd: () => void
  onScroll: (event: ReturnType<typeof scrollEvent>) => void
}

const buildContextValue = (overrides: Record<string, unknown> = {}): ScrollViewContextType =>
  ({
    footerHeightShared: { value: 0 },
    footerOffset: { value: 0 },
    headerHeightShared: { value: 0 },
    headerOffset: { value: 0 },
    pullSearchHeightShared: { value: 0 },
    scrollPosition: { value: 0 },
    snapBackFooterShared: { value: false },
    snapBackHeaderShared: { value: false },
    ...overrides
  }) as unknown as ScrollViewContextType

// onScroll/onEndDrag receive the raw event directly on the UI thread — unlike the JS-thread twin
// (useScrollHandlerJS), there's no `.nativeEvent` wrapper.
const scrollEvent = (x: number, y: number, contentHeight = 1000, layoutHeight = 500) => ({
  contentOffset: { x, y },
  contentSize: { height: contentHeight, width: 0 },
  layoutMeasurement: { height: layoutHeight, width: 0 }
})

const renderScrollHandler = (overrides: Partial<Parameters<typeof useScrollHandler>[0]> = {}, contextOverrides: Record<string, unknown> = {}) => {
  const contextValue = buildContextValue(contextOverrides)
  const capturedGeneration = { value: 0 } as unknown as SharedValue<number>
  const listGeneration = { value: 0 } as unknown as SharedValue<number>
  const chipHidden = { value: 0 } as unknown as SharedValue<number>
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(ScrollViewContext.Provider, { value: contextValue }, children)
  const rendered = renderHook(
    () =>
      useScrollHandler({
        capturedGeneration,
        chipHidden,
        footerFixed: false,
        headerFixed: false,
        listGeneration,
        ...overrides
      }) as unknown as MockedScrollHandler,
    { wrapper }
  )
  return { ...rendered, capturedGeneration, chipHidden, contextValue, listGeneration }
}

describe('useScrollHandler generation guard', () => {
  it('drops onScroll once listGeneration no longer matches the captured generation', () => {
    const { result, contextValue, listGeneration } = renderScrollHandler()
    listGeneration.value = 1 // a fresher instance mounted elsewhere and bumped the shared counter
    result.current.onScroll(scrollEvent(0, 500))
    expect(contextValue.scrollPosition.value).toBe(0) // stale event ignored entirely
  })

  it('processes onScroll normally once the generation matches', () => {
    const { result, contextValue, chipHidden } = renderScrollHandler()
    result.current.onScroll(scrollEvent(0, 50))
    expect(contextValue.scrollPosition.value).toBe(50)
    expect(chipHidden.value).toBe(1) // below the default 100 threshold

    result.current.onScroll(scrollEvent(0, 150))
    expect(contextValue.scrollPosition.value).toBe(150)
    expect(chipHidden.value).toBe(0) // at/above threshold
  })
})

describe('useScrollHandler remount sync', () => {
  it('retries via runOnJS while the reported position is still far from the target, without touching scroll state', () => {
    const onRemountSyncRetry = jest.fn()
    const onRemountSynced = jest.fn()
    const remountSyncTarget = { value: 50 } as unknown as SharedValue<number | null>
    const { result, contextValue, chipHidden } = renderScrollHandler({ onRemountSyncRetry, onRemountSynced, remountSyncTarget })

    result.current.onScroll(scrollEvent(0, 0))

    expect(onRemountSyncRetry).toHaveBeenCalledWith(0)
    expect(onRemountSynced).not.toHaveBeenCalled()
    expect(remountSyncTarget.value).toBe(50) // not cleared — still syncing
    expect(contextValue.scrollPosition.value).toBe(0) // untouched
    expect(chipHidden.value).toBe(0) // untouched — rest of onScroll never ran
  })

  it('clears the target and reports success once within tolerance, then resumes normal processing', () => {
    const onRemountSyncRetry = jest.fn()
    const onRemountSynced = jest.fn()
    const remountSyncTarget = { value: 50 } as unknown as SharedValue<number | null>
    const { result, contextValue } = renderScrollHandler({ onRemountSyncRetry, onRemountSynced, remountSyncTarget })

    result.current.onScroll(scrollEvent(0, 50)) // exact match, well within REMOUNT_SYNC_TOLERANCE

    expect(remountSyncTarget.value).toBeNull()
    expect(onRemountSynced).toHaveBeenCalledWith(50)
    expect(onRemountSyncRetry).not.toHaveBeenCalled()
    expect(contextValue.scrollPosition.value).toBe(0) // still untouched on this same call

    // A later call, with the target now cleared, falls through to ordinary scroll handling.
    result.current.onScroll(scrollEvent(0, 99))
    expect(contextValue.scrollPosition.value).toBe(99)
  })

  it('does not throw when no remount callbacks are supplied', () => {
    const remountSyncTarget = { value: 50 } as unknown as SharedValue<number | null>
    const { result } = renderScrollHandler({ remountSyncTarget })
    expect(() => result.current.onScroll(scrollEvent(0, 0))).not.toThrow()
    expect(() => result.current.onScroll(scrollEvent(0, 50))).not.toThrow()
    expect(remountSyncTarget.value).toBeNull()
  })
})

describe('useScrollHandler horizontal mode', () => {
  it('tracks x instead of y and skips snap-back logic entirely', () => {
    const { result, contextValue } = renderScrollHandler({ chipThreshold: 50, isHorizontal: true }, { headerOffset: { value: -40 }, footerOffset: { value: 25 }, snapBackFooterShared: { value: true }, snapBackHeaderShared: { value: true } })

    result.current.onScroll(scrollEvent(30, 9999, 9999, 1)) // huge y — would trigger bounce/snap in vertical mode
    expect(contextValue.scrollPosition.value).toBe(30) // x, not y
    expect(contextValue.headerOffset.value).toBe(-40) // untouched
    expect(contextValue.footerOffset.value).toBe(25) // untouched

    result.current.onScroll(scrollEvent(80, 0))
    expect(contextValue.scrollPosition.value).toBe(80)
  })

  it('gates chipHidden on the x threshold', () => {
    const { result, chipHidden } = renderScrollHandler({ chipThreshold: 50, isHorizontal: true })
    result.current.onScroll(scrollEvent(30, 0))
    expect(chipHidden.value).toBe(1)
    result.current.onScroll(scrollEvent(80, 0))
    expect(chipHidden.value).toBe(0)
  })
})

describe('useScrollHandler bottom bounce', () => {
  it('suppresses snap-up accumulation while overscrolled at the bottom, then resumes once genuinely scrolled back', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        footerHeightShared: { value: 50 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 600 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )

    // contentHeight 1000, layoutHeight 500 → maxScroll 500. y=580 is still within the bounce zone;
    // scrolling up (delta<0) here would otherwise start accumulating toward the snap-up trigger.
    result.current.onScroll(scrollEvent(0, 580, 1000, 500))
    expect(contextValue.headerOffset.value).toBe(-30) // unchanged — accumulation was suppressed
    expect(contextValue.footerOffset.value).toBe(15)

    // Now genuinely below maxScroll: the bounce clears and accumulation resumes from a clean 0,
    // driven entirely by this call's own (large) upward delta.
    result.current.onScroll(scrollEvent(0, 400, 1000, 500))
    expect(contextValue.headerOffset.value).toBe(0) // snapped via withTiming(0, ...)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandler snap-back at rest', () => {
  it('resets both offsets to zero when both header and footer are free to snap', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, -100, 500, 500)) // yn === -headerHeightShared.value
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('only snaps the header when the footer is fixed, even though snapBackFooterShared is true', () => {
    const { result, contextValue } = renderScrollHandler(
      { footerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, -100, 500, 500))
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(25) // unchanged — footer is fixed
  })

  it('only snaps the footer when the header is fixed, even though snapBackHeaderShared is true', () => {
    const { result, contextValue } = renderScrollHandler(
      { headerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, -100, 500, 500))
    expect(contextValue.headerOffset.value).toBe(-40) // unchanged — header is fixed
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('skips the whole snap-back block when both header and footer are fixed', () => {
    const { result, contextValue } = renderScrollHandler(
      { footerFixed: true, headerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, -100, 500, 500))
    expect(contextValue.headerOffset.value).toBe(-40)
    expect(contextValue.footerOffset.value).toBe(25)
  })
})

describe('useScrollHandler snap-back clamping while scrolling down', () => {
  it('clamps header/footer offsets toward their rest bounds once past the pull-search zone', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        footerHeightShared: { value: 50 },
        pullSearchHeightShared: { value: 20 },
        scrollPosition: { value: -100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )

    // threshold = -headerHeightShared + pullSearchHeightShared = -80
    result.current.onScroll(scrollEvent(0, -80, 500, 500)) // delta = -80 - (-100) = 20
    expect(contextValue.headerOffset.value).toBe(-20) // max(-100, min(0, 0 - 20))
    expect(contextValue.footerOffset.value).toBe(20) // max(0, min(50, 0 + 20))

    result.current.onScroll(scrollEvent(0, 500, 500, 500)) // delta = 580, well past both bounds
    expect(contextValue.headerOffset.value).toBe(-100) // clamped at the floor
    expect(contextValue.footerOffset.value).toBe(50) // clamped at the ceiling
  })

  it('does not clamp while still below the pull-search threshold, even with a positive delta', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        footerHeightShared: { value: 50 },
        pullSearchHeightShared: { value: 20 },
        scrollPosition: { value: -95 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    // yn = -90 is below the -80 threshold even though delta (-90 - -95 = 5) is positive
    result.current.onScroll(scrollEvent(0, -90, 500, 500))
    expect(contextValue.headerOffset.value).toBe(0) // untouched
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('clamps only the header when the footer is fixed', () => {
    const { result, contextValue } = renderScrollHandler(
      { footerFixed: true },
      {
        headerHeightShared: { value: 100 },
        footerHeightShared: { value: 50 },
        footerOffset: { value: 25 },
        pullSearchHeightShared: { value: 20 },
        scrollPosition: { value: -100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, -80, 500, 500)) // delta = 20, at the pull-search threshold
    expect(contextValue.headerOffset.value).toBe(-20) // max(-100, min(0, 0 - 20))
    expect(contextValue.footerOffset.value).toBe(25) // unchanged — footer is fixed
  })

  it('clamps only the footer when the header is fixed', () => {
    const { result, contextValue } = renderScrollHandler(
      { headerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerHeightShared: { value: 50 },
        pullSearchHeightShared: { value: 20 },
        scrollPosition: { value: -100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, -80, 500, 500)) // delta = 20
    expect(contextValue.headerOffset.value).toBe(-40) // unchanged — header is fixed
    expect(contextValue.footerOffset.value).toBe(20) // max(0, min(50, 0 + 20))
  })
})

describe('useScrollHandler snap-up accumulation while scrolling up', () => {
  it('does not accumulate while still below the pull-search threshold', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        pullSearchHeightShared: { value: 50 }, // threshold = -100 + 50 = -50
        scrollPosition: { value: -40 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    // Each of these lands below the -50 threshold, so the accumulator never even starts moving —
    // if it did, two -20 deltas would total 40 and still fall short of 10 anyway, so a snap here
    // can only mean the gate failed to hold accumulation back at all.
    result.current.onScroll(scrollEvent(0, -60, 500, 500)) // delta -20
    result.current.onScroll(scrollEvent(0, -80, 500, 500)) // delta -20
    expect(contextValue.headerOffset.value).toBe(-30)
    expect(contextValue.footerOffset.value).toBe(15)
  })

  it('snaps only the header via withTiming when the footer is fixed', () => {
    const { result, contextValue } = renderScrollHandler(
      { footerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, 94, 500, 500)) // accum 6
    result.current.onScroll(scrollEvent(0, 79, 500, 500)) // accum 6 + 15 = 21
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(15) // unchanged — footer is fixed
  })

  it('snaps only the footer via withTiming when the header is fixed', () => {
    const { result, contextValue } = renderScrollHandler(
      { headerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(0, 94, 500, 500)) // accum 6
    result.current.onScroll(scrollEvent(0, 79, 500, 500)) // accum 6 + 15 = 21
    expect(contextValue.headerOffset.value).toBe(-30) // unchanged — header is fixed
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandler onBeginDrag', () => {
  it('resets the snap-up accumulator so a drag interrupts an in-progress accumulation', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )

    result.current.onScroll(scrollEvent(0, 94, 500, 500)) // delta -6 → accum 6, below threshold
    expect(contextValue.headerOffset.value).toBe(-30)

    result.current.onBeginDrag()

    // Without the reset, this delta (-4) would bring the running total to 6 + 4 = 10 and snap.
    // With the reset it only reaches 4, so nothing fires yet.
    result.current.onScroll(scrollEvent(0, 90, 500, 500)) // delta -4
    expect(contextValue.headerOffset.value).toBe(-30) // still untouched
    expect(contextValue.footerOffset.value).toBe(15)

    result.current.onScroll(scrollEvent(0, 79, 500, 500)) // delta -11 → 4 + 11 = 15, crosses 10
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandler onMomentumEnd', () => {
  it('resets the snap-up accumulator the same way onBeginDrag does', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )

    result.current.onScroll(scrollEvent(0, 94, 500, 500)) // accum 6
    result.current.onMomentumEnd()
    result.current.onScroll(scrollEvent(0, 90, 500, 500)) // would-be accum 10, actually reset then 4
    expect(contextValue.headerOffset.value).toBe(-30)

    result.current.onScroll(scrollEvent(0, 79, 500, 500)) // 4 + 11 = 15
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandler onEndDrag', () => {
  it('returns immediately in horizontal mode without throwing', () => {
    const { result } = renderScrollHandler({ isHorizontal: true })
    expect(() => result.current.onEndDrag(scrollEvent(0, 495, 1000, 500))).not.toThrow()
  })

  it('resets the snap-up accumulator near the bottom, the same way onBeginDrag does', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )

    result.current.onScroll(scrollEvent(0, 94, 500, 500)) // accum 6

    // contentHeight 1000, layoutHeight 500 → threshold is 1000 - 500 - 10 = 490; 495 clears it.
    result.current.onEndDrag(scrollEvent(0, 495, 1000, 500))

    result.current.onScroll(scrollEvent(0, 90, 500, 500)) // would-be accum 10, actually reset then 4
    expect(contextValue.headerOffset.value).toBe(-30)

    result.current.onScroll(scrollEvent(0, 79, 500, 500)) // 4 + 11 = 15
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('does not reset the accumulator when nowhere near the bottom', () => {
    const { result, contextValue } = renderScrollHandler(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -30 },
        footerOffset: { value: 15 },
        scrollPosition: { value: 100 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )

    result.current.onScroll(scrollEvent(0, 94, 500, 500)) // accum 6
    result.current.onEndDrag(scrollEvent(0, 200, 1000, 500)) // well clear of the bottom — no reset

    // No reset happened, so this delta (-4) pushes the running total from 6 to 10 and snaps right away.
    result.current.onScroll(scrollEvent(0, 90, 500, 500))
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})
