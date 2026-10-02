import { renderHook } from '@testing-library/react'
import React from 'react'
import type { SharedValue } from 'react-native-reanimated'

import { useScrollHandler } from '../internal/useScrollHandler'
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

// onScroll/onEndDrag receive the raw event directly on the UI thread — unlike the JS-thread twin
// (useScrollHandlerJS), there's no `.nativeEvent` wrapper.
const scrollEvent = (x: number, y: number, contentHeight = 1000, layoutHeight = 500, velocity?: { x: number; y: number }) => ({
  contentOffset: { x, y },
  contentSize: { height: contentHeight, width: 0 },
  layoutMeasurement: { height: layoutHeight, width: 0 },
  velocity
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

// The hosted footer rides on a stack (footer + the persistent bar) taller than the footer alone, and
// the geometry that decides whether that stack can hide differs between inset mode and padding mode,
// so everything that goes through onScroll runs in both.
describe.each<[string, boolean]>([
  ['inset mode', true],
  ['padding mode', false]
])('useScrollHandler chrome host, %s', (_label, inset) => {
  // Events are described in inset space (rest = -HEADER_HEIGHT); padding mode reports raw offsets
  // shifted by the header height, so convert on the way into the handler.
  const raw = (yn: number) => (inset ? yn : yn + HEADER_HEIGHT)
  const scrollTo = (result: { current: MockedScrollHandler }, yn: number, contentHeight = 1000, layoutHeight = 500) => result.current.onScroll(scrollEvent(0, raw(yn), contentHeight, layoutHeight))

  beforeEach(() => {
    mockUsesContentInset = inset
  })
  afterEach(() => {
    mockUsesContentInset = true
  })

  describe('footer clamp', () => {
    it('clamps footerOffset to stackHeightShared, not footerHeightShared, when they differ', () => {
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT } }))
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
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared }))
      scrollTo(result, 400)
      expect(contextValue.footerOffset.value).toBe(80)

      stackHeightShared.value = 120 // e.g. the footer grew or the safe-area inset changed
      scrollTo(result, 450)
      expect(contextValue.footerOffset.value).toBe(120)
    })

    it('clamps the header against its own height, unaffected by the stack', () => {
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT }, snapBackHeaderShared: { value: true } }))
      scrollTo(result, 400)
      expect(contextValue.headerOffset.value).toBe(-HEADER_HEIGHT)
      expect(contextValue.footerOffset.value).toBe(80)
    })

    it('snaps footerOffset back to 0 via withTiming after enough upward scroll', () => {
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ footerOffset: { value: 70 }, scrollPosition: { value: 300 } }))
      scrollTo(result, 285) // delta -15 crosses the 10-point snap-up threshold
      expect(contextValue.footerOffset.value).toBe(0)
    })
  })

  describe('not the owner', () => {
    it('never writes footerOffset while chromeWritable is false, even though snapBackFooterShared is true', () => {
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ chromeWritable: { value: false }, footerOffset: { value: 25 }, scrollPosition: { value: -HEADER_HEIGHT } }))

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
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ chromeWritable: { value: false }, footerOffset: { value: 25 }, headerOffset: { value: -40 }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackHeaderShared: { value: true } }))
      scrollTo(result, -HEADER_HEIGHT)
      expect(contextValue.headerOffset.value).toBe(0)
      expect(contextValue.footerOffset.value).toBe(25)
    })

    it('starts writing again the moment chromeWritable turns true', () => {
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ chromeWritable: { value: false }, scrollPosition: { value: -HEADER_HEIGHT } }))
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
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ footerOffset: { value: 60 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: SHORT.stack } }))

      scrollTo(result, -70, SHORT.contentHeight, SHORT.layoutHeight) // delta 30 would otherwise track upward from 60
      expect(contextValue.footerOffset.value).toBe(0)

      scrollTo(result, -60, SHORT.contentHeight, SHORT.layoutHeight) // delta 10, still not tracked
      expect(contextValue.footerOffset.value).toBe(0)
    })

    it('leaves footerOffset alone when it is not writable, even on a short list', () => {
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ chromeWritable: { value: false }, footerOffset: { value: 60 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: SHORT.stack } }))
      scrollTo(result, -70, SHORT.contentHeight, SHORT.layoutHeight)
      expect(contextValue.footerOffset.value).toBe(60)
    })

    it('tracks normally when the list travels exactly as far as the stack is tall', () => {
      // maxScroll 100; the hide distance is maxScroll + header in inset mode, maxScroll in padding mode.
      const stack = inset ? 100 + HEADER_HEIGHT : 100
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: stack } }))
      scrollTo(result, -50, 600, 500) // delta 50
      expect(contextValue.footerOffset.value).toBe(50)
    })

    it('stops tracking one point below that boundary', () => {
      const stack = (inset ? 100 + HEADER_HEIGHT : 100) + 1
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ footerOffset: { value: 20 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: stack } }))
      scrollTo(result, -50, 600, 500)
      expect(contextValue.footerOffset.value).toBe(0)
    })

    it('measures the travel per mode: the header height counts toward it only in inset mode', () => {
      // maxScroll 100, stack 150: inset travel is 100 + 100 = 200 (hideable), padding travel is just 100 (not).
      const { result, contextValue } = renderScrollHandler({}, hostedContext({ footerOffset: { value: 60 }, scrollPosition: { value: -HEADER_HEIGHT }, stackHeightShared: { value: 150 } }))
      scrollTo(result, -70, 600, 500) // delta 30
      expect(contextValue.footerOffset.value).toBe(inset ? 90 : 0)
    })
  })

  describe('unhosted regression', () => {
    it('gives the fixture a stackHeightShared that is the same object as footerHeightShared', () => {
      const { contextValue } = renderScrollHandler({}, { footerHeightShared: { value: 50 } })
      expect(contextValue.chromeHosted).toBe(false)
      expect(contextValue.stackHeightShared).toBe(contextValue.footerHeightShared)
    })

    it('still clamps to footerHeightShared, following it as it changes', () => {
      const { result, contextValue } = renderScrollHandler({}, { footerHeightShared: { value: 50 }, headerHeightShared: { value: HEADER_HEIGHT }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackFooterShared: { value: true } })
      scrollTo(result, 400)
      expect(contextValue.footerOffset.value).toBe(50)

      contextValue.footerHeightShared.value = 30
      scrollTo(result, 450)
      expect(contextValue.footerOffset.value).toBe(30)
    })

    it('never applies the short-list gate: a tiny scroll range still tracks and a stale offset is not forced to 0', () => {
      const { result, contextValue } = renderScrollHandler({}, { footerHeightShared: { value: 50 }, footerOffset: { value: 10 }, headerHeightShared: { value: HEADER_HEIGHT }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackFooterShared: { value: true } })
      // maxScroll 20 → far too little travel to hide a 50-tall footer, but unhosted never asks.
      scrollTo(result, -80, 520, 500) // delta 20
      expect(contextValue.footerOffset.value).toBe(30)
    })

    it('tracks and snaps back on the very same events that the short-list gate blocks when hosted', () => {
      const { result, contextValue } = renderScrollHandler({}, { footerHeightShared: { value: 200 }, footerOffset: { value: 60 }, headerHeightShared: { value: HEADER_HEIGHT }, scrollPosition: { value: -HEADER_HEIGHT }, snapBackFooterShared: { value: true } })
      scrollTo(result, -70, 540, 500) // the same geometry the hosted short-list test forces to 0
      expect(contextValue.footerOffset.value).toBe(90)
    })
  })
})

describe('useScrollHandler chrome host settle', () => {
  const STACK = 100
  const settleContext = (overrides: Record<string, unknown> = {}) => hostedContext({ footerHeightShared: { value: 50 }, stackHeightShared: { value: STACK }, ...overrides })

  describe('on momentum end', () => {
    it.each([
      [0, 0],
      [10, 0],
      [49, 0],
      [50, 0], // exactly halfway rests shown
      [51, STACK],
      [99, STACK],
      [STACK, STACK]
    ])('settles an offset of %d to %d', (offset, expected) => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ footerOffset: { value: offset } }))
      result.current.onMomentumEnd()
      expect(contextValue.footerOffset.value).toBe(expected)
    })

    it('settles against stackHeightShared, not footerHeightShared', () => {
      // Against the 50-tall footer alone, 60 would be past halfway and land on 50.
      const { result, contextValue } = renderScrollHandler({}, settleContext({ footerOffset: { value: 60 } }))
      result.current.onMomentumEnd()
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('does not settle in horizontal mode', () => {
      const { result, contextValue } = renderScrollHandler({ isHorizontal: true }, settleContext({ footerOffset: { value: 60 } }))
      result.current.onMomentumEnd()
      expect(contextValue.footerOffset.value).toBe(60)
    })
  })

  describe('on drag end', () => {
    it.each<[string, { x: number; y: number } | undefined]>([
      ['undefined', undefined],
      ['zero', { x: 0, y: 0 }],
      ['slow downward', { x: 0, y: 0.05 }],
      ['slow upward', { x: 0, y: -0.05 }]
    ])('settles when velocity is %s', (_label, velocity) => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ footerOffset: { value: 60 } }))
      result.current.onEndDrag(scrollEvent(0, 0, 1000, 500, velocity))
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('settles down toward 0 as well', () => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ footerOffset: { value: 40 } }))
      result.current.onEndDrag(scrollEvent(0, 0, 1000, 500, { x: 0, y: 0 }))
      expect(contextValue.footerOffset.value).toBe(0)
    })

    it.each<[string, { x: number; y: number }]>([
      ['at the 0.1 threshold', { x: 0, y: 0.1 }],
      ['fast downward', { x: 0, y: 2 }],
      ['fast upward', { x: 0, y: -2 }]
    ])('does not settle when velocity is %s, leaving it to the momentum that follows', (_label, velocity) => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ footerOffset: { value: 60 } }))
      result.current.onEndDrag(scrollEvent(0, 0, 1000, 500, velocity))
      expect(contextValue.footerOffset.value).toBe(60)

      result.current.onMomentumEnd() // the deferred settle
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('does not settle in horizontal mode', () => {
      const { result, contextValue } = renderScrollHandler({ isHorizontal: true }, settleContext({ footerOffset: { value: 60 } }))
      result.current.onEndDrag(scrollEvent(0, 0, 1000, 500, { x: 0, y: 0 }))
      expect(contextValue.footerOffset.value).toBe(60)
    })
  })

  describe.each<[string, (result: { current: MockedScrollHandler }) => void]>([
    ['onMomentumEnd', (result) => result.current.onMomentumEnd()],
    ['onEndDrag', (result) => result.current.onEndDrag(scrollEvent(0, 0, 1000, 500, { x: 0, y: 0 }))]
  ])('%s never settles', (_name, trigger) => {
    it('settles when hosted, not fixed and writable (control for the cases below)', () => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(STACK)
    })

    it('when unhosted', () => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ chromeHosted: false, footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(60)
    })

    it('when the footer is fixed (Footer Lock)', () => {
      const { result, contextValue } = renderScrollHandler({ footerFixed: true }, settleContext({ footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(60)
    })

    it('when chromeWritable is false (not the owner, or pinned)', () => {
      const { result, contextValue } = renderScrollHandler({}, settleContext({ chromeWritable: { value: false }, footerOffset: { value: 60 } }))
      trigger(result)
      expect(contextValue.footerOffset.value).toBe(60)
    })
  })
})

// The 10pt scroll-up latch (snapUpAccum >= 10) starts a withTiming(0) reveal; a settle that ran while
// that animation was still in flight would read the in-flight offset, and if it was still past
// halfway pick "hidden" — reversing a deliberate reveal. (The reanimated mock's withTiming lands on
// its target instantly, so each test puts the offset back where the real animation would still be.)
describe('useScrollHandler chrome host settle vs the reveal latch', () => {
  const STACK = 100
  const startReveal = () => {
    const { result, contextValue } = renderScrollHandler({}, hostedContext({ footerOffset: { value: 70 }, scrollPosition: { value: 300 }, stackHeightShared: { value: STACK } }))
    result.current.onScroll(scrollEvent(0, 285)) // delta -15 crosses the 10-point threshold: the reveal starts
    contextValue.footerOffset.value = 60 // where the animation still is, past halfway
    return { result, contextValue }
  }

  it('keeps revealing on momentum end instead of settling on the in-flight offset', () => {
    const { result, contextValue } = startReveal()
    result.current.onMomentumEnd()
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('keeps revealing on a drag end that will stop here', () => {
    const { result, contextValue } = startReveal()
    result.current.onEndDrag(scrollEvent(0, 285, 1000, 500, { x: 0, y: 0 }))
    expect(contextValue.footerOffset.value).toBe(0)
  })

  it('forgets the latch once a new drag begins, so a plain settle picks the nearest end again', () => {
    const { result, contextValue } = startReveal()
    result.current.onBeginDrag()
    result.current.onMomentumEnd()
    expect(contextValue.footerOffset.value).toBe(STACK)
  })

  it('forgets the latch after a momentum end, so a later settle picks the nearest end', () => {
    const { result, contextValue } = startReveal()
    result.current.onMomentumEnd()
    contextValue.footerOffset.value = 60
    result.current.onMomentumEnd()
    expect(contextValue.footerOffset.value).toBe(STACK)
  })
})
