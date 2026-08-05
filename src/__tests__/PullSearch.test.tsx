import { act, render } from '@testing-library/react'
import React from 'react'
import Animated from 'react-native-reanimated'

import { getLastSearchbarRef } from '../__mocks__/react-native-paper'
import { PullSearch, type PullSearchHandle } from '../PullSearch'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

const HEADER_HEIGHT = 40
const BAR_HEIGHT = 36
// showY: natural rest position, bar fully visible just below the header.
const SHOW_Y = -HEADER_HEIGHT
// hideY: bar scrolled up behind the header — this is the threshold the auto-blur reaction fires at.
const HIDE_Y = -HEADER_HEIGHT + BAR_HEIGHT

describe('PullSearch', () => {
  it('renders without crashing', () => {
    render(<PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper })
  })

  it('renders with placeholder', () => {
    render(
      <PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} placeholder='Search items...' />,
      { wrapper }
    )
  })

  it('renders with initial value', () => {
    render(<PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} value='hello' />, { wrapper })
  })

  it('exposes blur and focus via imperative ref', () => {
    const ref = React.createRef<PullSearchHandle>()
    render(<PullSearch ref={ref} onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper })
    expect(typeof ref.current?.blur).toBe('function')
    expect(typeof ref.current?.focus).toBe('function')
  })

  it('does not throw when blur/focus called with no input mounted', () => {
    const ref = React.createRef<PullSearchHandle>()
    render(<PullSearch ref={ref} onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper })
    expect(() => ref.current?.blur()).not.toThrow()
    expect(() => ref.current?.focus()).not.toThrow()
  })

  // Regression test for the 2026-08-03 fix: this component's useAnimatedReaction read
  // scrollPosition.value but didn't list `scrollPosition` in its own dependency array, so on web it
  // evaluated once at mount and then silently never again — the search bar stayed focused forever
  // instead of auto-blurring once scrolled out of view. This test drives scrollPosition through a
  // ScrollViewContext.Provider we control directly (not the real ScrollViewProvider, which only
  // exposes headerHeight/scrollPosition through its own internal state) so it can assert the
  // reaction actually re-fires on a later render, not just at mount.
  it('auto-blurs the input once scrolled behind the header (rest -> hidden)', () => {
    const scrollPosition = { value: SHOW_Y }
    const contextValue = { headerHeight: HEADER_HEIGHT, scrollPosition } as unknown as ScrollViewContextType
    const contextWrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewContext.Provider value={contextValue}>{children}</ScrollViewContext.Provider>

    const { rerender } = render(<PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper: contextWrapper })

    // Nothing in this mocked environment fires onLayout on its own — pull it off the last
    // Animated.View render and invoke it manually to establish a real barHeight, exactly like a
    // native layout pass would.
    const AnimatedViewMock = Animated.View as unknown as jest.Mock
    const lastCall = AnimatedViewMock.mock.calls[AnimatedViewMock.mock.calls.length - 1]
    const onLayout = lastCall?.[0]?.onLayout as ((e: { nativeEvent: { layout: { height: number } } }) => void) | undefined
    expect(onLayout).toBeDefined()
    act(() => onLayout?.({ nativeEvent: { layout: { height: BAR_HEIGHT } } }))

    const inputRef = getLastSearchbarRef()
    expect(inputRef?.blur).not.toHaveBeenCalled()

    // Scroll the bar up behind the header. Mutating scrollPosition.value alone doesn't trigger a
    // React render (the same reason this bug was invisible without a fix) — re-rendering with an
    // otherwise-identical element is what stands in here for "some later render happens", forcing
    // the mocked useAnimatedReaction (or the real one, in the actual package) to re-evaluate against
    // the now-mutated value.
    scrollPosition.value = HIDE_Y
    act(() => {
      rerender(<PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} />)
    })

    expect(inputRef?.blur).toHaveBeenCalledTimes(1)
  })
})
