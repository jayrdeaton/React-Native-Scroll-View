import { renderHook } from '@testing-library/react'
import React from 'react'
import type { SharedValue } from 'react-native-reanimated'

import { useScrollHandlerJS } from '../internal/useScrollHandlerJS'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'

// usesContentInset is a module-level constant derived from Platform.OS at import time, so the
// padding-mode (Android/web) geometry can only be reached by swapping the module itself. The getter
// is read lazily on every use, letting a test flip modes without re-importing the handler under test.
let mockUsesContentInset = true
jest.mock('../internal/insetMode', () => ({
  get usesContentInset() {
    return mockUsesContentInset
  }
}))

const REMOUNT_RETRY_MAX_ATTEMPTS = 8

// Defaults to an unhosted provider, mirroring the real one: chromeWritable is always true and
// stackHeightShared IS footerHeightShared (the same object), so the footer clamp behaves exactly as
// it did before the chrome host existed. Hosted tests override chromeHosted and give
// stackHeightShared a value of its own (see hostedContext).
const buildContextValue = (overrides: Record<string, unknown> = {}): ScrollViewContextType => {
  const footerHeightShared = overrides.footerHeightShared ?? { value: 0 }
  return {
    chromeHosted: false,
    chromeWritable: { value: true },
    footerHeightShared,
    footerOffset: { value: 0 },
    headerHeightShared: { value: 0 },
    headerOffset: { value: 0 },
    pullSearchHeightShared: { value: 0 },
    scrollPosition: { value: 0 },
    snapBackFooterShared: { value: false },
    snapBackHeaderShared: { value: false },
    stackHeightShared: footerHeightShared,
    ...overrides
  } as unknown as ScrollViewContextType
}

// A hosted provider whose stack (footer + the bar it rides on) is taller than the footer alone.
const HEADER_HEIGHT = 100
const hostedContext = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  chromeHosted: true,
  footerHeightShared: { value: 50 },
  headerHeightShared: { value: HEADER_HEIGHT },
  snapBackFooterShared: { value: true },
  stackHeightShared: { value: 80 },
  ...overrides
})

const scrollEvent = (y: number, { contentHeight = 1000, layoutHeight = 500, velocity, x = 0 }: { contentHeight?: number; layoutHeight?: number; velocity?: { x: number; y: number }; x?: number } = {}) =>
  ({
    nativeEvent: {
      contentOffset: { x, y },
      contentSize: { height: contentHeight, width: 0 },
      layoutMeasurement: { height: layoutHeight, width: 0 },
      velocity
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

// The hosted footer rides on a stack (footer + the persistent bar) taller than the footer alone, and
// the geometry that decides whether that stack can hide differs between inset mode and padding mode,
// so everything that goes through onScroll runs in both.
describe.each<[string, boolean]>([
  ['inset mode', true],
  ['padding mode', false]
])('useScrollHandlerJS chrome host, %s', (_label, inset) => {
  // Events are described in inset space (rest = -HEADER_HEIGHT); padding mode reports raw offsets
  // shifted by the header height, so convert on the way into the handler.
  const raw = (yn: number) => (inset ? yn : yn + HEADER_HEIGHT)
  const scrollTo = (result: { current: ReturnType<typeof useScrollHandlerJS> }, yn: number, contentHeight = 1000, layoutHeight = 500) => result.current.onScroll(scrollEvent(raw(yn), { contentHeight, layoutHeight }))

  beforeEach(() => {
    mockUsesContentInset = inset
  })
  afterEach(() => {
    mockUsesContentInset = true
  })

  describe('footer clamp', () => {
    it('clamps footerOffset to stackHeightShared, not footerHeightShared, when they differ', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT } }))
      expect(contextValue.stackHeightShared).not.toBe(contextValue.footerHeightShared)

      scrollTo(result, -60) // delta 40
      expect(contextValue.footerOffset.value).toBe(40)

      scrollTo(result, -30) // delta 30 → 70: past footerHeightShared (50), still inside the stack (80)
      expect(contextValue.footerOffset.value).toBe(70)

      scrollTo(result, 400) // delta 430, well past both
      expect(contextValue.footerOffset.value).toBe(80) // the stack height, not the footer's 50
    })

    it('follows stackHeightShared as it changes', () => {
      const stackHeightShared = { value: 80 }
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared }))
      scrollTo(result, 400)
      expect(contextValue.footerOffset.value).toBe(80)

      stackHeightShared.value = 120 // e.g. the footer grew or the safe-area inset changed
      scrollTo(result, 450)
      expect(contextValue.footerOffset.value).toBe(120)
    })

    it('clamps the header against its own height, unaffected by the stack', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT }, snapBackHeaderShared: { value: true } }))
      scrollTo(result, 400)
      expect(contextValue.headerOffset.value).toBe(-HEADER_HEIGHT)
      expect(contextValue.footerOffset.value).toBe(80)
    })

    it('snaps footerOffset back to 0 via withTiming after enough upward scroll', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ footerOffset: { value: 70 }, scrollPosition: { value: 300 } }))
      scrollTo(result, 285) // delta -15 crosses the 10-point snap-up threshold
      expect(contextValue.footerOffset.value).toBe(0)
    })
  })

  describe('not the owner', () => {
    it('never writes footerOffset while chromeWritable is false, even though snapBackFooterShared is true', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ chromeWritable: { value: false }, footerOffset: { value: 25 }, scrollPosition: { value: -HEADER_HEIGHT } }))

      scrollTo(result, -60) // scrolling down would clamp/track
      scrollTo(result, 200)
      expect(contextValue.footerOffset.value).toBe(25)

      scrollTo(result, 150) // scrolling up past the snap-up threshold would withTiming to 0
      scrollTo(result, 100)
      expect(contextValue.footerOffset.value).toBe(25)

      scrollTo(result, -HEADER_HEIGHT) // back at rest would reset to 0
      expect(contextValue.footerOffset.value).toBe(25)
    })

    it('still snaps the header while the footer is not writable', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ chromeWritable: { value: false }, footerOffset: { value: 25 }, headerOffset: { value: -40 }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackHeaderShared: { value: true } }))
      scrollTo(result, -HEADER_HEIGHT)
      expect(contextValue.headerOffset.value).toBe(0)
      expect(contextValue.footerOffset.value).toBe(25)
    })

    it('starts writing again the moment chromeWritable turns true', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ chromeWritable: { value: false }, scrollPosition: { value: -HEADER_HEIGHT } }))
      scrollTo(result, -60)
      expect(contextValue.footerOffset.value).toBe(0)

      contextValue.chromeWritable.value = true
      scrollTo(result, -30) // delta 30 from the previous event
      expect(contextValue.footerOffset.value).toBe(30)
    })
  })

  describe('short list', () => {
    // contentHeight 540 in a 500 viewport → maxScroll 40. Hiding a stack of 200 needs at least that
    // much travel in either mode (inset adds the header height: 40 + 100 = 140, still short).
    const SHORT = { contentHeight: 540, layoutHeight: 500, stack: 200 }

    it('forces a stale footerOffset back to 0 and does not track scrolling when the stack cannot fully hide', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ footerOffset: { value: 60 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: SHORT.stack } }))

      scrollTo(result, -70, SHORT.contentHeight, SHORT.layoutHeight) // delta 30 would otherwise track upward from 60
      expect(contextValue.footerOffset.value).toBe(0)

      scrollTo(result, -60, SHORT.contentHeight, SHORT.layoutHeight) // delta 10, still not tracked
      expect(contextValue.footerOffset.value).toBe(0)
    })

    it('leaves footerOffset alone when it is not writable, even on a short list', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ chromeWritable: { value: false }, footerOffset: { value: 60 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: SHORT.stack } }))
      scrollTo(result, -70, SHORT.contentHeight, SHORT.layoutHeight)
      expect(contextValue.footerOffset.value).toBe(60)
    })

    it('tracks normally when the list travels exactly as far as the stack is tall', () => {
      // maxScroll 100; the hide distance is maxScroll + header in inset mode, maxScroll in padding mode.
      const stack = inset ? 100 + HEADER_HEIGHT : 100
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: stack } }))
      scrollTo(result, -50, 600, 500) // delta 50
      expect(contextValue.footerOffset.value).toBe(50)
    })

    it('stops tracking one point below that boundary', () => {
      const stack = (inset ? 100 + HEADER_HEIGHT : 100) + 1
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ footerOffset: { value: 20 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: stack } }))
      scrollTo(result, -50, 600, 500)
      expect(contextValue.footerOffset.value).toBe(0)
    })

    it('measures the travel per mode: the header height counts toward it only in inset mode', () => {
      // maxScroll 100, stack 150: inset travel is 100 + 100 = 200 (hideable), padding travel is just 100 (not).
      const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ footerOffset: { value: 60 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: 150 } }))
      scrollTo(result, -70, 600, 500) // delta 30
      expect(contextValue.footerOffset.value).toBe(inset ? 90 : 0)
    })
  })

  describe('unhosted regression', () => {
    it('gives the fixture a stackHeightShared that is the same object as footerHeightShared', () => {
      const { contextValue } = renderScrollHandlerJS({}, { footerHeightShared: { value: 50 } })
      expect(contextValue.chromeHosted).toBe(false)
      expect(contextValue.stackHeightShared).toBe(contextValue.footerHeightShared)
    })

    it('still clamps to footerHeightShared, following it as it changes', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, { footerHeightShared: { value: 50 }, headerHeightShared: { value: HEADER_HEIGHT }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackFooterShared: { value: true } })
      scrollTo(result, 400)
      expect(contextValue.footerOffset.value).toBe(50)

      contextValue.footerHeightShared.value = 30
      scrollTo(result, 450)
      expect(contextValue.footerOffset.value).toBe(30)
    })

    it('never applies the short-list gate: a tiny scroll range still tracks and a stale offset is not forced to 0', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, { footerHeightShared: { value: 50 }, footerOffset: { value: 10 }, headerHeightShared: { value: HEADER_HEIGHT }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackFooterShared: { value: true } })
      // maxScroll 20 → far too little travel to hide a 50-tall footer, but unhosted never asks.
      scrollTo(result, -80, 520, 500) // delta 20
      expect(contextValue.footerOffset.value).toBe(30)
    })

    it('tracks and snaps back on the very same events that the short-list gate blocks when hosted', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, { footerHeightShared: { value: 200 }, footerOffset: { value: 60 }, headerHeightShared: { value: HEADER_HEIGHT }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackFooterShared: { value: true } })
      scrollTo(result, -70, 540, 500) // the same geometry the hosted short-list test forces to 0
      expect(contextValue.footerOffset.value).toBe(90)
    })
  })
})

describe('useScrollHandlerJS chrome host settle', () => {
  const STACK = 100
  const settleContext = (overrides: Record<string, unknown> = {}) => hostedContext({ footerHeightShared: { value: 50 }, stackHeightShared: { value: STACK }, ...overrides })

  describe('on momentum scroll end', () => {
    it.each([
      [0, 0],
      [10, 0],
      [49, 0],
      [50, 0], // exactly halfway rests shown
      [51, STACK],
      [99, STACK],
      [STACK, STACK]
    ])('settles an offset of %d to %d', (offset, expected) => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ footerOffset: { value: offset } }))
      result.current.onMomentumScrollEnd(scrollEvent(0))
      expect(contextValue.footerOffset.value).toBe(expected)
    })

    it('settles against stackHeightShared, not footerHeightShared', () => {
      // Against the 50-tall footer alone, 60 would be past halfway and land on 50.
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ footerOffset: { value: 60 } }))
      result.current.onMomentumScrollEnd(scrollEvent(0))
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('does not settle in horizontal mode', () => {
      const { result, contextValue } = renderScrollHandlerJS({ isHorizontal: true }, settleContext({ footerOffset: { value: 60 } }))
      result.current.onMomentumScrollEnd(scrollEvent(0))
      expect(contextValue.footerOffset.value).toBe(60)
    })
  })

  describe('on scroll end drag', () => {
    it.each<[string, { x: number; y: number } | undefined]>([
      ['undefined', undefined],
      ['zero', { x: 0, y: 0 }],
      ['slow downward', { x: 0, y: 0.05 }],
      ['slow upward', { x: 0, y: -0.05 }]
    ])('settles when velocity is %s', (_label, velocity) => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ footerOffset: { value: 60 } }))
      result.current.onScrollEndDrag(scrollEvent(0, { velocity }))
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('settles down toward 0 as well', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ footerOffset: { value: 40 } }))
      result.current.onScrollEndDrag(scrollEvent(0, { velocity: { x: 0, y: 0 } }))
      expect(contextValue.footerOffset.value).toBe(0)
    })

    it.each<[string, { x: number; y: number }]>([
      ['at the 0.1 threshold', { x: 0, y: 0.1 }],
      ['fast downward', { x: 0, y: 2 }],
      ['fast upward', { x: 0, y: -2 }]
    ])('does not settle when velocity is %s, leaving it to the momentum that follows', (_label, velocity) => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ footerOffset: { value: 60 } }))
      result.current.onScrollEndDrag(scrollEvent(0, { velocity }))
      expect(contextValue.footerOffset.value).toBe(60)

      result.current.onMomentumScrollEnd(scrollEvent(0)) // the deferred settle
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('does not settle in horizontal mode', () => {
      const { result, contextValue } = renderScrollHandlerJS({ isHorizontal: true }, settleContext({ footerOffset: { value: 60 } }))
      result.current.onScrollEndDrag(scrollEvent(0, { velocity: { x: 0, y: 0 } }))
      expect(contextValue.footerOffset.value).toBe(60)
    })
  })

  describe.each<[string, (result: { current: ReturnType<typeof useScrollHandlerJS> }) => void]>([
    ['onMomentumScrollEnd', (result) => result.current.onMomentumScrollEnd(scrollEvent(0))],
    ['onScrollEndDrag', (result) => result.current.onScrollEndDrag(scrollEvent(0, { velocity: { x: 0, y: 0 } }))]
  ])('%s never settles', (_name, trigger) => {
    it('settles when hosted, not fixed and writable (control for the cases below)', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('when unhosted', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ chromeHosted: false, footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(60)
    })

    it('when the footer is fixed (Footer Lock)', () => {
      const { result, contextValue } = renderScrollHandlerJS({ footerFixed: true }, settleContext({ footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(60)
    })

    it('when chromeWritable is false (not the owner, or pinned)', () => {
      const { result, contextValue } = renderScrollHandlerJS({}, settleContext({ chromeWritable: { value: false }, footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(60)
    })
  })
})

// The 10pt scroll-up latch (snapUpAccum >= 10) starts a withTiming(0) reveal; a settle that ran while
// that animation was still in flight would read the in-flight offset, and if it was still past
// halfway pick "hidden" — reversing a deliberate reveal. (The reanimated mock's withTiming lands on
// its target instantly, so each test puts the offset back where the real animation would still be.)
describe('useScrollHandlerJS chrome host settle vs the reveal latch', () => {
  const STACK = 100
  const startReveal = () => {
    const { result, contextValue } = renderScrollHandlerJS({}, hostedContext({ footerOffset: { value: 70 }, scrollPosition: { value: 300 }, stackHeightShared: { value: STACK } }))
    result.current.onScroll(scrollEvent(285)) // delta -15 crosses the 10-point threshold: the reveal starts
    contextValue.footerOffset.value = 60 // where the animation still is, past halfway
    return { result, contextValue }
  }

  it('keeps revealing on momentum scroll end instead of settling on the in-flight offset', () => {
    const { result, contextValue } = startReveal()
    result.current.onMomentumScrollEnd(scrollEvent(285))
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('keeps revealing on a scroll end drag that will stop here', () => {
    const { result, contextValue } = startReveal()
    result.current.onScrollEndDrag(scrollEvent(285, { velocity: { x: 0, y: 0 } }))
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('forgets the latch once a new drag begins, so a plain settle picks the nearest end again', () => {
    const { result, contextValue } = startReveal()
    result.current.onScrollBeginDrag(scrollEvent(285))
    result.current.onMomentumScrollEnd(scrollEvent(285))
    expect(contextValue.footerOffset.value).toBe(STACK)
  })

  it('forgets the latch after a momentum scroll end, so a later settle picks the nearest end', () => {
    const { result, contextValue } = startReveal()
    result.current.onMomentumScrollEnd(scrollEvent(285))
    contextValue.footerOffset.value = 60
    result.current.onMomentumScrollEnd(scrollEvent(285))
    expect(contextValue.footerOffset.value).toBe(STACK)
  })
})
