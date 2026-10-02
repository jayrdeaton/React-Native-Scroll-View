import { act, render } from '@testing-library/react'
import React from 'react'
import { type LayoutChangeEvent, Platform, View } from 'react-native'
import { Appbar, Surface } from 'react-native-paper'
import Animated from 'react-native-reanimated'

import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { ScrollViewFooter } from '../ScrollViewFooter'
import { ScrollViewHeader } from '../ScrollViewHeader'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

// The mocked Appbar.BackAction (see __mocks__/react-native-paper.ts) renders nothing at all, so
// the only way to observe which path ScrollViewHeader took is the mock's own call record — not
// anything queryable in the rendered tree.
const mockBackAction = jest.mocked(Appbar.BackAction)
// Same technique as ScrollViewChip.test.tsx's mocked Chip: Animated.View (see
// __mocks__/react-native-reanimated.ts) is a jest.fn(stub), so its own call record is how we read
// back onLayout and the worklet-computed styles (translateStyle/blurStyle) a test can't otherwise
// observe — useAnimatedStyle's mock result never escapes the component.
const mockAnimatedView = jest.mocked(Animated.View)
const mockSurface = jest.mocked(Surface)
const mockView = jest.mocked(View)

const sharedValue = <T,>(value: T) => ({ value })

// Builds a full ScrollViewContextType so a test can drive ScrollViewHeader's worklets
// (translateStyle/blurStyle) directly with arbitrary SharedValue-like inputs, without needing a
// real ScrollViewProvider re-render to get there — same pattern as useScrollList.test.ts's
// buildContextValue. Overrides are untyped (rather than Partial<ScrollViewContextType>) because the
// real SharedValue<T> type demands get/set/addListener/etc that only the actual Reanimated runtime
// provides — the mock (and every override below) only ever needs the plain `{ value }` shape.
const buildHeaderContext = (overrides: Record<string, unknown> = {}): ScrollViewContextType =>
  ({
    blur: true,
    chromeHosted: false,
    chromeOverhang: 0,
    chromeWritable: sharedValue(true),
    footerAboveKeyboard: false,
    footerHeight: null,
    footerHeightShared: sharedValue(0),
    footerFixed: false,
    footerOffset: sharedValue(0),
    headerHeight: null,
    headerHeightShared: sharedValue(0),
    headerFixed: false,
    headerOffset: sharedValue(0),
    jsListGeneration: { current: 0 },
    listGeneration: sharedValue(0),
    onJsListUnmount: jest.fn(),
    onListUnmount: jest.fn(),
    progress: null,
    progressing: false,
    pullSearchHeightShared: sharedValue(0),
    scrollHeight: 0,
    scrollPosition: sharedValue(0),
    setFooterHeight: jest.fn(),
    setHeaderHeight: jest.fn(),
    setProgress: jest.fn(),
    setProgressing: jest.fn(),
    snapBackFooterShared: sharedValue(false),
    snapBackHeaderShared: sharedValue(false),
    stackHeightShared: sharedValue(0),
    tabBarHeight: 0,
    ...overrides
  }) as unknown as ScrollViewContextType

// The header content Animated.View (the one wrapping children/title/caption) is the only one
// ScrollViewHeader passes onLayout to — blur/progress/leading/trailing each render their own
// Animated.View too, so filter for the prop rather than assume a position.
const lastHeaderContentProps = () => {
  const calls = mockAnimatedView.mock.calls.filter((call) => typeof (call[0] as { onLayout?: unknown }).onLayout === 'function')
  return calls[calls.length - 1][0] as { onLayout: (e: LayoutChangeEvent) => void; style: [unknown, { transform?: unknown }] }
}

// blurStyle's result always has a lone `height` key (unlike translateStyle's `transform` or
// progressStyle's `top`), so that shape alone is enough to pick its Animated.View out from the rest.
const lastBlurViewProps = () => {
  const calls = mockAnimatedView.mock.calls.filter((call) => {
    const style = (call[0] as { style?: unknown }).style
    return Array.isArray(style) && style[1] !== null && typeof style[1] === 'object' && 'height' in (style[1] as object)
  })
  return calls[calls.length - 1][0] as { style: [unknown, { height: number }] }
}

// Re-renders the SAME component instance (not a remount) with a possibly-updated context value —
// needed after calling the captured onLayout directly, since that mutates the header's internal
// measuredShared SharedValue but doesn't itself trigger React to re-run useAnimatedStyle's factory
// (the mock recomputes fresh on every render rather than reacting to the mutation).
const rerenderWithContext = (rerender: (ui: React.ReactElement) => void, contextValue: ScrollViewContextType, children: React.ReactNode) => rerender(<ScrollViewContext.Provider value={contextValue}>{children}</ScrollViewContext.Provider>)

describe('ScrollViewHeader', () => {
  beforeEach(() => {
    mockBackAction.mockClear()
    mockAnimatedView.mockClear()
    mockSurface.mockClear()
    mockView.mockClear()
  })

  it('renders without crashing', () => {
    render(<ScrollViewHeader />, { wrapper })
  })

  it('renders with children', () => {
    render(
      <ScrollViewHeader>
        <></>
      </ScrollViewHeader>,
      { wrapper }
    )
  })

  it('renders the default Appbar.BackAction, passed through onPress/accessibilityLabel, when backAction is a plain callback', () => {
    const onPress = () => {}
    render(<ScrollViewHeader backAction={onPress} backActionAccessibilityLabel='Close' />, { wrapper })
    expect(mockBackAction).toHaveBeenCalledTimes(1)
    expect(mockBackAction.mock.calls[0][0]).toEqual(expect.objectContaining({ onPress, accessibilityLabel: 'Close' }))
  })

  it('renders a custom element in place of the default Appbar.BackAction when backAction is a ReactNode', () => {
    const { getByTestId } = render(<ScrollViewHeader backAction={<button data-testid='custom-back' />} />, { wrapper })
    expect(getByTestId('custom-back')).toBeTruthy()
    expect(mockBackAction).not.toHaveBeenCalled()
  })

  it('does not apply a top safe-area inset when topInset is false', () => {
    render(<ScrollViewHeader topInset={false} />, { wrapper })
    const hasZeroPaddingTop = mockView.mock.calls.some((call) => {
      const style = (call[0] as { style?: unknown }).style
      const styleArr = Array.isArray(style) ? style : [style]
      return styleArr.some((s) => s && typeof s === 'object' && (s as { paddingTop?: number }).paddingTop === 0)
    })
    expect(hasZeroPaddingTop).toBe(true)
  })

  it('calls setHeaderHeight only when the measured height differs from the current headerHeight', () => {
    const setHeaderHeight = jest.fn()
    const contextValue = buildHeaderContext({ headerHeight: 100, setHeaderHeight })
    render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader />
      </ScrollViewContext.Provider>
    )
    const { onLayout } = lastHeaderContentProps()

    act(() => onLayout({ nativeEvent: { layout: { height: 200 } } } as LayoutChangeEvent))
    expect(setHeaderHeight).toHaveBeenCalledTimes(1)
    expect(setHeaderHeight).toHaveBeenCalledWith(200)

    // Same height as the context's current headerHeight (100) — setHeaderHeight must not fire again.
    act(() => onLayout({ nativeEvent: { layout: { height: 100 } } } as LayoutChangeEvent))
    expect(setHeaderHeight).toHaveBeenCalledTimes(1)
  })

  it('translates the header upward by the scrolled-past amount once effective scroll exceeds zero', () => {
    const contextValue = buildHeaderContext({
      headerFixed: false,
      headerHeightShared: sharedValue(100),
      pullSearchHeightShared: sharedValue(0),
      scrollPosition: sharedValue(1000),
      snapBackHeaderShared: sharedValue(false)
    })
    render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader />
      </ScrollViewContext.Provider>
    )
    // effective = scrollPosition(1000) + headerHeightShared(100) - pullSearchHeightShared(0) = 1100
    expect(lastHeaderContentProps().style[1]).toEqual({ transform: [{ translateY: -1100 }] })
  })

  it('renders the blur backdrop at zero height once measured but headerHeightShared is still 0', () => {
    const contextValue = buildHeaderContext({ headerHeightShared: sharedValue(0) })
    const { rerender } = render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader />
      </ScrollViewContext.Provider>
    )
    const { onLayout } = lastHeaderContentProps()
    act(() => onLayout({ nativeEvent: { layout: { height: 0 } } } as LayoutChangeEvent))
    rerenderWithContext(rerender, contextValue, <ScrollViewHeader />)
    expect(lastBlurViewProps().style[1]).toEqual({ height: 0 })
  })

  it('pins the blur backdrop to the full header height when headerFixed', () => {
    const contextValue = buildHeaderContext({ headerFixed: true, headerHeightShared: sharedValue(120) })
    const { rerender } = render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader />
      </ScrollViewContext.Provider>
    )
    const { onLayout } = lastHeaderContentProps()
    act(() => onLayout({ nativeEvent: { layout: { height: 120 } } } as LayoutChangeEvent))
    rerenderWithContext(rerender, contextValue, <ScrollViewHeader />)
    expect(lastBlurViewProps().style[1]).toEqual({ height: 120 })
  })

  it('sizes the blur backdrop off headerOffset when snapBackHeaderShared is true', () => {
    const contextValue = buildHeaderContext({
      headerFixed: false,
      headerHeightShared: sharedValue(100),
      headerOffset: sharedValue(50),
      snapBackHeaderShared: sharedValue(true)
    })
    const { rerender } = render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader />
      </ScrollViewContext.Provider>
    )
    const { onLayout } = lastHeaderContentProps()
    act(() => onLayout({ nativeEvent: { layout: { height: 100 } } } as LayoutChangeEvent))
    rerenderWithContext(rerender, contextValue, <ScrollViewHeader />)
    // headerHeightShared(100) + headerOffset(50) = 150, above the 44px top-inset floor
    expect(lastBlurViewProps().style[1]).toEqual({ height: 150 })
  })

  it('shrinks the blur backdrop as the header scrolls off, floored at the top inset', () => {
    const contextValue = buildHeaderContext({
      headerFixed: false,
      headerHeightShared: sharedValue(100),
      pullSearchHeightShared: sharedValue(0),
      scrollPosition: sharedValue(30),
      snapBackHeaderShared: sharedValue(false)
    })
    const { rerender } = render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader />
      </ScrollViewContext.Provider>
    )
    const { onLayout } = lastHeaderContentProps()
    act(() => onLayout({ nativeEvent: { layout: { height: 100 } } } as LayoutChangeEvent))
    rerenderWithContext(rerender, contextValue, <ScrollViewHeader />)
    // 100 - Math.max(0, 30 + 100 - 0) = -30, floored at the 44px top inset
    expect(lastBlurViewProps().style[1]).toEqual({ height: 44 })
  })

  // ScrollViewProvider's own `blur` prop defaults to undefined, and the mocked useBlur
  // (__mocks__/auto-paper.ts) resolves that to `false` — so every other test in this file, all
  // rendered via the default `wrapper`, already exercises the blur:false path. blur:true (and
  // therefore ActionBg's BlurView branch / the header omitting its divider) only happens here.
  it('renders ActionBg via BlurView (not Surface) and omits the header divider when blur is true', () => {
    const contextValue = buildHeaderContext({ blur: true })
    render(
      <ScrollViewContext.Provider value={contextValue}>
        <ScrollViewHeader backAction={() => {}} />
      </ScrollViewContext.Provider>
    )
    expect(mockSurface).not.toHaveBeenCalled()
    const hasDivider = mockView.mock.calls.some((call) => {
      const style = (call[0] as { style?: unknown }).style
      const styleArr = Array.isArray(style) ? style : [style]
      return styleArr.some((s) => s && typeof s === 'object' && (s as { backgroundColor?: string }).backgroundColor === '#cac4d0')
    })
    expect(hasDivider).toBe(false)
  })

  it('renders trailingAction fixed in place by default', () => {
    const { getByTestId } = render(<ScrollViewHeader trailingAction={<button data-testid='trailing' />} />, { wrapper })
    expect(getByTestId('trailing')).toBeTruthy()
  })

  it('renders trailingAction so it scrolls with the header when trailingActionFixed is false', () => {
    const { getByTestId } = render(<ScrollViewHeader trailingAction={<button data-testid='trailing' />} trailingActionFixed={false} />, { wrapper })
    expect(getByTestId('trailing')).toBeTruthy()
  })

  it('renders the back action so it scrolls with the header when backActionFixed is false', () => {
    const onPress = () => {}
    render(<ScrollViewHeader backAction={onPress} backActionFixed={false} />, { wrapper })
    expect(mockBackAction).toHaveBeenCalledTimes(1)
  })

  it('renders a custom backAction element so it scrolls with the header when backActionFixed is false', () => {
    const { getByTestId } = render(<ScrollViewHeader backAction={<button data-testid='custom-back' />} backActionFixed={false} />, { wrapper })
    expect(getByTestId('custom-back')).toBeTruthy()
    expect(mockBackAction).not.toHaveBeenCalled()
  })

  it('renders title text when provided', () => {
    const { getByText } = render(<ScrollViewHeader title='Title text' />, { wrapper })
    expect(getByText('Title text')).toBeTruthy()
  })

  it('renders caption text when provided', () => {
    const { getByText } = render(<ScrollViewHeader caption='Caption text' />, { wrapper })
    expect(getByText('Caption text')).toBeTruthy()
  })

  it('renders centerContent in place of title/caption when provided', () => {
    const { getByTestId, queryByText } = render(<ScrollViewHeader caption='Caption text' centerContent={<button data-testid='center' />} title='Title text' />, { wrapper })
    expect(getByTestId('center')).toBeTruthy()
    expect(queryByText('Title text')).toBeNull()
    expect(queryByText('Caption text')).toBeNull()
  })

  describe('web pre-paint measurement', () => {
    const originalOS = Platform.OS
    // The content View is the one ScrollViewHeader hands a ref; give it a real-looking DOM height
    // the way react-native-web's host node would. React 19 passes `ref` to function components as
    // a plain prop, so the mocked View can fill it in during render, before layout effects run.
    const withDomHeight = (offsetHeight: number) =>
      mockView.mockImplementation(((props: { children?: React.ReactNode; ref?: { current: unknown } }) => {
        if (props.ref && typeof props.ref === 'object') props.ref.current = { offsetHeight }
        return props.children ?? null
      }) as never)
    let rafSpy: jest.SpyInstance
    beforeEach(() => {
      Platform.OS = 'web' as typeof Platform.OS
      // Hold every rAF so the provider's two-frame fallback can never be what sets the height here.
      rafSpy = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0)
    })
    afterEach(() => {
      Platform.OS = originalOS
      rafSpy.mockRestore()
      mockView.mockImplementation(((props: { children?: React.ReactNode }) => props.children ?? null) as never)
    })

    it('commits the measured height before the first paint, never painting a 0 or unmeasured layout first', () => {
      withDomHeight(129)
      const seen: (number | null)[] = []
      const Reader = () => {
        seen.push(React.useContext(ScrollViewContext).headerHeight)
        return null
      }
      render(
        <ScrollViewProvider>
          <ScrollViewHeader title='Title' />
          <Reader />
        </ScrollViewProvider>
      )
      // render() returns only after the layout-effect update has re-rendered synchronously, i.e.
      // before the browser could have painted the null-height pass.
      expect(seen[seen.length - 1]).toBe(129)
      expect(seen).not.toContain(0)
      expect(rafSpy).toHaveBeenCalled()
    })

    it('replaces a fallback 0 the moment a header mounts after it', () => {
      withDomHeight(129)
      let ctx: ScrollViewContextType | undefined
      const Reader = () => {
        ctx = React.useContext(ScrollViewContext)
        return null
      }
      const { rerender } = render(
        <ScrollViewProvider>
          <Reader />
        </ScrollViewProvider>
      )
      act(() => ctx!.setHeaderHeight(0))
      expect(ctx!.headerHeight).toBe(0)
      rerender(
        <ScrollViewProvider>
          <ScrollViewHeader title='Title' />
          <Reader />
        </ScrollViewProvider>
      )
      expect(ctx!.headerHeight).toBe(129)
    })

    it('leaves a node with no layout box (hidden ancestor) to onLayout instead of committing 0', () => {
      withDomHeight(0)
      let ctx: ScrollViewContextType | undefined
      const Reader = () => {
        ctx = React.useContext(ScrollViewContext)
        return null
      }
      render(
        <ScrollViewProvider>
          <ScrollViewHeader title='Title' />
          <Reader />
        </ScrollViewProvider>
      )
      expect(ctx!.headerHeight).toBeNull()
    })

    it('does nothing on native, where onLayout is reliable', () => {
      Platform.OS = 'ios'
      withDomHeight(129)
      let ctx: ScrollViewContextType | undefined
      const Reader = () => {
        ctx = React.useContext(ScrollViewContext)
        return null
      }
      render(
        <ScrollViewProvider>
          <ScrollViewHeader title='Title' />
          <Reader />
        </ScrollViewProvider>
      )
      expect(ctx!.headerHeight).toBeNull()
    })
  })
})

describe('ScrollViewFooter', () => {
  it('renders without crashing', () => {
    render(<ScrollViewFooter />, { wrapper })
  })

  it('renders with children', () => {
    render(
      <ScrollViewFooter>
        <></>
      </ScrollViewFooter>,
      { wrapper }
    )
  })
})
