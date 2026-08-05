import { act, renderHook } from '@testing-library/react'

import { useStickyHeaders } from '../internal/useStickyHeaders'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'

const HEADER_HEIGHT = 50

// headerFixed:true keeps stickyTop === headerHeightShared.value regardless of scroll, so the
// active-section math below only has to reason about one variable (scrollPosition) instead of
// also modeling snapBack/pull-search offsets.
const buildContextValue = (scrollPosition: { value: number }): ScrollViewContextType =>
  ({
    headerHeightShared: { value: HEADER_HEIGHT },
    headerOffset: { value: 0 },
    pullSearchHeightShared: { value: 0 },
    scrollPosition,
    snapBackHeaderShared: { value: false }
  }) as unknown as ScrollViewContextType

describe('useStickyHeaders', () => {
  // Regression test for the 2026-08-03 fix: the useAnimatedReaction driving activeIndex read
  // scrollPosition/headerHeightShared/etc. but didn't list them in its own dependency array, so on
  // web it evaluated once at mount (activeIndex stuck at -1, or whatever section was active at
  // mount) and never again — SectionList's sticky header silently froze on the first section
  // forever instead of tracking scroll.
  it('updates activeIndex as scrollPosition crosses each section boundary', () => {
    const scrollPosition = { value: 0 }
    const contextValue = buildContextValue(scrollPosition)
    const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewContext.Provider value={contextValue}>{children}</ScrollViewContext.Provider>

    const { result, rerender } = renderHook(() => useStickyHeaders(true, true), { wrapper })

    act(() => {
      result.current.resetPositions(3)
      // Sections at content-Y 0, 200, 400 (scrollPosition is 0 at measurement time, so pageY ==
      // contentY here).
      result.current.measureHeader(0, 0, 40)
      result.current.measureHeader(1, 200, 40)
      result.current.measureHeader(2, 400, 40)
    })
    rerender()
    // threshold = scrollPosition(0) + stickyTop(50) = 50; only section 0's position (0) is below it.
    expect(result.current.activeIndex).toBe(0)

    act(() => {
      scrollPosition.value = 250
    })
    rerender()
    // threshold = 250 + 50 = 300; sections 0 (0) and 1 (200) qualify, section 2 (400) doesn't ->
    // the last qualifying section, 1, is active.
    expect(result.current.activeIndex).toBe(1)

    act(() => {
      scrollPosition.value = 450
    })
    rerender()
    // threshold = 450 + 50 = 500; all three qualify -> the last one, 2, is active.
    expect(result.current.activeIndex).toBe(2)

    act(() => {
      scrollPosition.value = 0
    })
    rerender()
    // Scrolling back up returns to section 0 — confirms this isn't a one-way ratchet.
    expect(result.current.activeIndex).toBe(0)
  })
})
