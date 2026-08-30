import { renderHook } from '@testing-library/react'
import React from 'react'
import type { SharedValue } from 'react-native-reanimated'

import { useScrollHandlerJS } from '../internal/useScrollHandlerJS'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'

const REMOUNT_RETRY_MAX_ATTEMPTS = 8

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

const scrollEvent = (y: number, { contentHeight = 1000, layoutHeight = 500, x = 0 }: { contentHeight?: number; layoutHeight?: number; x?: number } = {}) =>
  ({
    nativeEvent: {
      contentOffset: { x, y },
      contentSize: { height: contentHeight, width: 0 },
      layoutMeasurement: { height: layoutHeight, width: 0 }
    }
  }) as never

const renderScrollHandlerJS = (overrides: Partial<Parameters<typeof useScrollHandlerJS>[0]> = {}, contextOverrides: Record<string, unknown> = {}) => {
  const contextValue = buildContextValue(contextOverrides)
  const chipHidden = { value: 0 } as unknown as SharedValue<number>
  const capturedGeneration = { current: 0 }
  const jsListGeneration = { current: 0 }
  const scrollTo = jest.fn()
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(ScrollViewContext.Provider, { value: contextValue }, children)
  const rendered = renderHook(
    () =>
      useScrollHandlerJS({
        capturedGeneration,
        chipHidden,
        footerFixed: false,
        headerFixed: false,
        jsListGeneration,
        scrollTo,
        ...overrides
      }),
    { wrapper }
  )
  return { ...rendered, capturedGeneration, chipHidden, contextValue, jsListGeneration, scrollTo }
}

describe('useScrollHandlerJS generation guard', () => {
  it('processes onScroll and updates scrollPosition/chipHidden when the generation matches', () => {
    const { result, contextValue, chipHidden } = renderScrollHandlerJS({ chipThreshold: 100 })
    result.current.onScroll(scrollEvent(50))
    expect(contextValue.scrollPosition.value).toBe(50)
    expect(chipHidden.value).toBe(1) // below threshold

    result.current.onScroll(scrollEvent(150))
    expect(contextValue.scrollPosition.value).toBe(150)
    expect(chipHidden.value).toBe(0) // at/above threshold
  })

  it('drops onScroll from a zombie handler once jsListGeneration no longer matches its capturedGeneration', () => {
    const { result, contextValue, capturedGeneration, jsListGeneration } = renderScrollHandlerJS()
    result.current.onScroll(scrollEvent(10))
    expect(contextValue.scrollPosition.value).toBe(10)

    // Another list instance mounted/unmounted elsewhere and bumped the shared generation counter —
    // this handler's own capturedGeneration (frozen at mount) is now stale.
    jsListGeneration.current = 1
    expect(capturedGeneration.current).toBe(0)

    result.current.onScroll(scrollEvent(999))
    expect(contextValue.scrollPosition.value).toBe(10) // unchanged — the stale event was ignored
  })

  it('lets a fresh instance keep working even while a stale sibling is guarded out', () => {
    const jsListGeneration = { current: 1 }
    const { result, contextValue } = renderScrollHandlerJS({ capturedGeneration: { current: 1 }, jsListGeneration })
    result.current.onScroll(scrollEvent(42))
    expect(contextValue.scrollPosition.value).toBe(42)
  })
})

describe('useScrollHandlerJS remount retry', () => {
  it('retries with a non-animated scrollTo until an onScroll event confirms the target position', () => {
    const { result, scrollTo, contextValue } = renderScrollHandlerJS({ remountTarget: -40 })
    result.current.onScroll(scrollEvent(0)) // native reports the wrong position
    expect(scrollTo).toHaveBeenCalledWith(-40, false)
    expect(contextValue.scrollPosition.value).toBe(0) // not yet treated as a real scroll position

    scrollTo.mockClear()
    result.current.onScroll(scrollEvent(-40)) // confirmed
    expect(scrollTo).not.toHaveBeenCalled()
    expect(contextValue.scrollPosition.value).toBe(-40) // now processed normally
  })

  it('gives up after REMOUNT_RETRY_MAX_ATTEMPTS and falls through to normal processing rather than blocking forever', () => {
    const { result, scrollTo, contextValue } = renderScrollHandlerJS({ remountTarget: -40 })
    for (let i = 0; i < REMOUNT_RETRY_MAX_ATTEMPTS; i += 1) result.current.onScroll(scrollEvent(0))
    expect(scrollTo).toHaveBeenCalledTimes(REMOUNT_RETRY_MAX_ATTEMPTS)

    scrollTo.mockClear()
    result.current.onScroll(scrollEvent(0)) // one more, past the max — gives up
    expect(scrollTo).not.toHaveBeenCalled()
    expect(contextValue.scrollPosition.value).toBe(0) // accepted as-is instead of retrying forever
  })

  it('the generation guard takes precedence over an in-progress remount retry', () => {
    const { result, scrollTo, contextValue, jsListGeneration } = renderScrollHandlerJS({ remountTarget: -40 })
    jsListGeneration.current = 1 // stale before the remount retry ever gets a chance to run
    result.current.onScroll(scrollEvent(0))
    expect(scrollTo).not.toHaveBeenCalled()
    expect(contextValue.scrollPosition.value).toBe(0) // untouched — onScroll bailed out immediately
  })
})

describe('useScrollHandlerJS isHorizontal mode', () => {
  it('tracks x instead of y and skips snap-back logic entirely', () => {
    const { result, contextValue } = renderScrollHandlerJS({ chipThreshold: 50, isHorizontal: true }, { headerOffset: { value: -40 }, footerOffset: { value: 25 }, snapBackFooterShared: { value: true }, snapBackHeaderShared: { value: true } })

    result.current.onScroll(scrollEvent(9999, { x: 30, contentHeight: 9999, layoutHeight: 1 })) // huge y — would trigger bounce/snap in vertical mode
    expect(contextValue.scrollPosition.value).toBe(30) // x, not y
    expect(contextValue.headerOffset.value).toBe(-40) // untouched
    expect(contextValue.footerOffset.value).toBe(25) // untouched

    result.current.onScroll(scrollEvent(0, { x: 80 }))
    expect(contextValue.scrollPosition.value).toBe(80)
  })

  it('gates chipHidden on the x threshold', () => {
    const { result, chipHidden } = renderScrollHandlerJS({ chipThreshold: 50, isHorizontal: true })
    result.current.onScroll(scrollEvent(0, { x: 30 }))
    expect(chipHidden.value).toBe(1)
    result.current.onScroll(scrollEvent(0, { x: 80 }))
    expect(chipHidden.value).toBe(0)
  })
})

describe('useScrollHandlerJS bottom bounce', () => {
  it('suppresses snap-up accumulation while overscrolled at the bottom, then resumes once genuinely scrolled back', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(580, { contentHeight: 1000, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(-30) // unchanged — accumulation was suppressed
    expect(contextValue.footerOffset.value).toBe(15)

    // Now genuinely below maxScroll: the bounce clears and accumulation resumes from a clean 0,
    // driven entirely by this call's own (large) upward delta.
    result.current.onScroll(scrollEvent(400, { contentHeight: 1000, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(0) // snapped via withTiming(0, ...)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandlerJS snap-back at rest', () => {
  it('resets both offsets to zero when both header and footer are free to snap', () => {
    const { result, contextValue } = renderScrollHandlerJS(
      {},
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(-100, { contentHeight: 500, layoutHeight: 500 })) // yn === -headerHeightShared.value
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('only snaps the header when the footer is fixed, even though snapBackFooterShared is true', () => {
    const { result, contextValue } = renderScrollHandlerJS(
      { footerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(-100, { contentHeight: 500, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(25) // unchanged — footer is fixed
  })

  it('only snaps the footer when the header is fixed, even though snapBackHeaderShared is true', () => {
    const { result, contextValue } = renderScrollHandlerJS(
      { headerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(-100, { contentHeight: 500, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(-40) // unchanged — header is fixed
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('skips the whole snap-back block when both header and footer are fixed', () => {
    const { result, contextValue } = renderScrollHandlerJS(
      { footerFixed: true, headerFixed: true },
      {
        headerHeightShared: { value: 100 },
        headerOffset: { value: -40 },
        footerOffset: { value: 25 },
        snapBackFooterShared: { value: true },
        snapBackHeaderShared: { value: true }
      }
    )
    result.current.onScroll(scrollEvent(-100, { contentHeight: 500, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(-40)
    expect(contextValue.footerOffset.value).toBe(25)
  })
})

describe('useScrollHandlerJS snap-back clamping while scrolling down', () => {
  it('clamps header/footer offsets toward their rest bounds once past the pull-search zone', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(-80, { contentHeight: 500, layoutHeight: 500 })) // delta = -80 - (-100) = 20
    expect(contextValue.headerOffset.value).toBe(-20) // max(-100, min(0, 0 - 20))
    expect(contextValue.footerOffset.value).toBe(20) // max(0, min(50, 0 + 20))

    result.current.onScroll(scrollEvent(500, { contentHeight: 500, layoutHeight: 500 })) // delta = 580, well past both bounds
    expect(contextValue.headerOffset.value).toBe(-100) // clamped at the floor
    expect(contextValue.footerOffset.value).toBe(50) // clamped at the ceiling
  })

  it('does not clamp while still below the pull-search threshold, even with a positive delta', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(-90, { contentHeight: 500, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(0) // untouched
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('clamps only the header when the footer is fixed', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(-80, { contentHeight: 500, layoutHeight: 500 })) // delta = 20, at the pull-search threshold
    expect(contextValue.headerOffset.value).toBe(-20) // max(-100, min(0, 0 - 20))
    expect(contextValue.footerOffset.value).toBe(25) // unchanged — footer is fixed
  })

  it('clamps only the footer when the header is fixed', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(-80, { contentHeight: 500, layoutHeight: 500 })) // delta = 20
    expect(contextValue.headerOffset.value).toBe(-40) // unchanged — header is fixed
    expect(contextValue.footerOffset.value).toBe(20) // max(0, min(50, 0 + 20))
  })
})

describe('useScrollHandlerJS snap-up accumulation while scrolling up', () => {
  it('does not accumulate while still below the pull-search threshold', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(-60, { contentHeight: 500, layoutHeight: 500 })) // delta -20
    result.current.onScroll(scrollEvent(-80, { contentHeight: 500, layoutHeight: 500 })) // delta -20
    expect(contextValue.headerOffset.value).toBe(-30)
    expect(contextValue.footerOffset.value).toBe(15)
  })

  it('snaps only the header via withTiming when the footer is fixed', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(94, { contentHeight: 500, layoutHeight: 500 })) // accum 6
    result.current.onScroll(scrollEvent(79, { contentHeight: 500, layoutHeight: 500 })) // accum 6 + 15 = 21
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(15) // unchanged — footer is fixed
  })

  it('snaps only the footer via withTiming when the header is fixed', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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
    result.current.onScroll(scrollEvent(94, { contentHeight: 500, layoutHeight: 500 })) // accum 6
    result.current.onScroll(scrollEvent(79, { contentHeight: 500, layoutHeight: 500 })) // accum 6 + 15 = 21
    expect(contextValue.headerOffset.value).toBe(-30) // unchanged — header is fixed
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandlerJS onScrollBeginDrag', () => {
  it('resets the snap-up accumulator so a drag interrupts an in-progress accumulation', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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

    result.current.onScroll(scrollEvent(94, { contentHeight: 500, layoutHeight: 500 })) // delta -6 → accum 6, below threshold
    expect(contextValue.headerOffset.value).toBe(-30)

    result.current.onScrollBeginDrag(scrollEvent(0))

    // Without the reset, this delta (-4) would bring the running total to 6 + 4 = 10 and snap.
    // With the reset it only reaches 4, so nothing fires yet.
    result.current.onScroll(scrollEvent(90, { contentHeight: 500, layoutHeight: 500 })) // delta -4
    expect(contextValue.headerOffset.value).toBe(-30) // still untouched
    expect(contextValue.footerOffset.value).toBe(15)

    result.current.onScroll(scrollEvent(79, { contentHeight: 500, layoutHeight: 500 })) // delta -11 → 4 + 11 = 15, crosses 10
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandlerJS onMomentumScrollEnd', () => {
  it('resets the snap-up accumulator the same way onScrollBeginDrag does', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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

    result.current.onScroll(scrollEvent(94, { contentHeight: 500, layoutHeight: 500 })) // accum 6
    result.current.onMomentumScrollEnd(scrollEvent(0))
    result.current.onScroll(scrollEvent(90, { contentHeight: 500, layoutHeight: 500 })) // would-be accum 10, actually reset then 4
    expect(contextValue.headerOffset.value).toBe(-30)

    result.current.onScroll(scrollEvent(79, { contentHeight: 500, layoutHeight: 500 })) // 4 + 11 = 15
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})

describe('useScrollHandlerJS onScrollEndDrag', () => {
  it('returns immediately in horizontal mode without throwing', () => {
    const { result } = renderScrollHandlerJS({ isHorizontal: true })
    expect(() => result.current.onScrollEndDrag(scrollEvent(495, { contentHeight: 1000, layoutHeight: 500 }))).not.toThrow()
  })

  it('resets the snap-up accumulator near the bottom, the same way onScrollBeginDrag does', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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

    result.current.onScroll(scrollEvent(94, { contentHeight: 500, layoutHeight: 500 })) // accum 6

    // contentHeight 1000, layoutHeight 500 → threshold is 1000 - 500 - 10 = 490; 495 clears it.
    result.current.onScrollEndDrag(scrollEvent(495, { contentHeight: 1000, layoutHeight: 500 }))

    result.current.onScroll(scrollEvent(90, { contentHeight: 500, layoutHeight: 500 })) // would-be accum 10, actually reset then 4
    expect(contextValue.headerOffset.value).toBe(-30)

    result.current.onScroll(scrollEvent(79, { contentHeight: 500, layoutHeight: 500 })) // 4 + 11 = 15
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('does not reset the accumulator when nowhere near the bottom', () => {
    const { result, contextValue } = renderScrollHandlerJS(
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

    result.current.onScroll(scrollEvent(94, { contentHeight: 500, layoutHeight: 500 })) // accum 6
    result.current.onScrollEndDrag(scrollEvent(200, { contentHeight: 1000, layoutHeight: 500 })) // well clear of the bottom — no reset

    // No reset happened, so this delta (-4) pushes the running total from 6 to 10 and snaps right away.
    result.current.onScroll(scrollEvent(90, { contentHeight: 500, layoutHeight: 500 }))
    expect(contextValue.headerOffset.value).toBe(0)
    expect(contextValue.footerOffset.value).toBe(0)
  })
})
