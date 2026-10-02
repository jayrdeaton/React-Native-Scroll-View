import { act, render } from '@testing-library/react'
import React from 'react'
import { type LayoutChangeEvent, Platform, View } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import Animated from 'react-native-reanimated'

import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { ScrollViewFooter } from '../ScrollViewFooter'
import { ScrollViewProvider } from '../ScrollViewProvider'

const SAFE_AREA_BOTTOM = 34
const KEYBOARD_HEIGHT = 300

// Overrides are untyped (rather than Partial<ScrollViewContextType>) because the real SharedValue<T>
// type demands members only the Reanimated runtime provides; the mock and every fixture here only
// ever need the plain `{ value }` shape.
const buildContextValue = (overrides: Record<string, unknown> = {}): ScrollViewContextType =>
  ({
    blur: false,
    chromeHosted: false,
    chromeOverhang: 0,
    chromeWritable: { value: true },
    footerAboveKeyboard: false,
    footerHeight: 0,
    footerHeightShared: { value: 0 },
    footerFixed: true,
    footerOffset: { value: 0 },
    headerHeightShared: { value: 0 },
    pullSearchHeightShared: { value: 0 },
    scrollPosition: { value: 0 },
    setFooterHeight: jest.fn(),
    snapBackFooterShared: { value: false },
    stackHeightShared: { value: 0 },
    tabBarHeight: 0,
    ...overrides
  }) as unknown as ScrollViewContextType

const renderFooter = (overrides: Record<string, unknown>, style?: React.ComponentProps<typeof ScrollViewFooter>['style']) => {
  const contextValue = buildContextValue(overrides)
  return render(
    <ScrollViewContext.Provider value={contextValue}>
      <ScrollViewFooter style={style} />
    </ScrollViewContext.Provider>
  )
}

// Same pattern as useScrollList.test.ts: drive useKeyboardInset's internal state via the onMove
// handler this hook registered with useKeyboardHandler.
const openKeyboard = (height: number) => {
  const handlerMock = useKeyboardHandler as jest.Mock
  const { onMove } = handlerMock.mock.calls[handlerMock.mock.calls.length - 1][0]
  act(() => onMove({ height }))
}

const findPaddingBottom = (mock: jest.Mock) => {
  for (let i = mock.mock.calls.length - 1; i >= 0; i -= 1) {
    const props = mock.mock.calls[i][0]
    const styleArray = Array.isArray(props.style) ? props.style : [props.style]
    const paddingEntry = styleArray.find((entry: unknown) => entry !== null && typeof entry === 'object' && 'paddingBottom' in (entry as object))
    if (paddingEntry) return (paddingEntry as { paddingBottom: number }).paddingBottom
  }
  return undefined
}

// The row (plain RN View) holds the safe-area ramp; the outer Animated.View container holds the
// keyboard-floating growth. Two different mocked components, so two separate lookups.
const lastRowPaddingBottom = () => findPaddingBottom(View as unknown as jest.Mock)
const lastContainerPaddingBottom = () => findPaddingBottom(Animated.View as unknown as jest.Mock)

describe('ScrollViewFooter safe-area padding', () => {
  it('keeps the safe-area bottom inset when sitting at the screen edge (keyboard closed)', () => {
    renderFooter({ footerAboveKeyboard: true, footerFixed: true })
    expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM)
  })

  it('keeps the safe-area inset when footerAboveKeyboard is off, even with the keyboard open', () => {
    renderFooter({ footerAboveKeyboard: false, footerFixed: true })
    openKeyboard(KEYBOARD_HEIGHT)
    expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM)
  })

  // Regression test for the fix requested after shipping footerAboveKeyboard: the bar no longer
  // sits at the physical screen edge once it's floating above an open keyboard, so the
  // home-indicator safe-area padding underneath its content (e.g. a Save button) is just dead
  // space and should be dropped.
  it('drops the safe-area inset once floating above an open keyboard', () => {
    renderFooter({ footerAboveKeyboard: true, footerFixed: true })
    openKeyboard(KEYBOARD_HEIGHT)
    expect(lastRowPaddingBottom()).toBe(0)
  })

  it('keeps the safe-area inset when the footer is not fixed, even with footerAboveKeyboard set', () => {
    renderFooter({ footerAboveKeyboard: true, footerFixed: false })
    openKeyboard(KEYBOARD_HEIGHT)
    expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM)
  })

  // Regression test: a consumer's own style.paddingBottom (e.g. a small gap matching the header's
  // actionMargin) used to be spread after the computed safe-area padding, silently replacing it —
  // consuming apps that set their own vertical rhythm padding lost the home-indicator clearance
  // entirely. It must add on top of the inset instead.
  it("adds a consumer style's paddingBottom on top of the safe-area inset instead of replacing it", () => {
    renderFooter({ footerAboveKeyboard: true, footerFixed: true }, { paddingBottom: 4 })
    expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM + 4)
  })

  it('still applies the rest of a consumer style (e.g. paddingHorizontal) unchanged', () => {
    renderFooter({ footerAboveKeyboard: true, footerFixed: true }, { paddingBottom: 4, paddingHorizontal: 16 })
    const calls = (View as unknown as jest.Mock).mock.calls
    const rowCall = calls[calls.length - 1]
    const styleArray = Array.isArray(rowCall[0].style) ? rowCall[0].style : [rowCall[0].style]
    const horizontalEntry = styleArray.find((entry: unknown) => entry !== null && typeof entry === 'object' && 'paddingHorizontal' in (entry as object))
    expect((horizontalEntry as { paddingHorizontal: number }).paddingHorizontal).toBe(16)
  })

  // Regression test for the "drops to the bottom then snaps back up" glitch: padding must ramp
  // continuously with keyboardHeight rather than flip as a boolean the instant the keyboard fully
  // closes, otherwise the row's height jumps by insets.bottom in a single frame right as
  // translateY finishes its own descent.
  describe('ramps continuously through the final insets.bottom of keyboard travel (no pop)', () => {
    it('stays at 0 padding while the keyboard is still taller than the safe-area inset', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: true })
      openKeyboard(SAFE_AREA_BOTTOM + 1)
      expect(lastRowPaddingBottom()).toBe(0)
    })

    it('fills in exactly the remaining gap once the keyboard shrinks below the inset', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: true })
      openKeyboard(20)
      expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM - 20)
      openKeyboard(5)
      expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM - 5)
    })

    it('keeps containerPaddingBottom + rowPaddingBottom constant through the final stretch, so on-screen content position never jumps', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: true })
      for (const height of [30, 15, 5, 0]) {
        openKeyboard(height)
        expect(lastContainerPaddingBottom()! + lastRowPaddingBottom()!).toBe(SAFE_AREA_BOTTOM)
      }
    })
  })

  // Regression test for the visible gap (and worse, at the keyboard's rounded top corners) between
  // the footer and the keyboard: floating must GROW the container so its bottom edge — and the
  // BlurView filling it — always seals against the true physical screen bottom, rather than
  // translating a fixed-height bar away from it.
  describe('container growth keeps the blur backdrop sealed to the true screen bottom', () => {
    it('does not grow the container when sitting at the screen edge (keyboard closed)', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: true })
      expect(lastContainerPaddingBottom()).toBe(0)
    })

    it('grows the container by exactly the keyboard height while floating', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: true })
      openKeyboard(KEYBOARD_HEIGHT)
      expect(lastContainerPaddingBottom()).toBe(KEYBOARD_HEIGHT)
    })

    it('never grows the container when footerAboveKeyboard is off, even with the keyboard open', () => {
      renderFooter({ footerAboveKeyboard: false, footerFixed: true })
      openKeyboard(KEYBOARD_HEIGHT)
      expect(lastContainerPaddingBottom()).toBe(0)
    })

    it('never grows the container when the footer is not fixed, even with footerAboveKeyboard set', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: false })
      openKeyboard(KEYBOARD_HEIGHT)
      expect(lastContainerPaddingBottom()).toBe(0)
    })
  })
})

// The container Animated.View's style is [styles.footer, { bottom, paddingBottom }, footerStyle], so
// the worklet-computed translate and the geometry are both readable off its last render's props.
type FooterProps = { onLayout: (e: LayoutChangeEvent) => void; style: [unknown, { bottom: number; paddingBottom: number }, { transform: { translateY: number }[] }] }
const lastFooterProps = () => {
  const calls = (Animated.View as unknown as jest.Mock).mock.calls
  return calls[calls.length - 1][0] as FooterProps
}
const lastTranslateY = () => lastFooterProps().style[2].transform[0].translateY
const lastBottom = () => lastFooterProps().style[1].bottom

// The value fixtures below are plain `{ value }` stand-ins for SharedValues, so a test can re-render
// after mutating one and read the recomputed worklet (the mocked useAnimatedStyle re-runs its
// factory on every render).
describe('ScrollViewFooter translate (unhosted)', () => {
  it('stays put when the footer is fixed, whatever the scroll or offset', () => {
    renderFooter({ footerFixed: true, footerHeight: 60, footerOffset: { value: 25 }, scrollPosition: { value: 200 }, snapBackFooterShared: { value: true } })
    expect(lastTranslateY()).toBe(0)
  })

  describe('without snap-back', () => {
    it('is 0 while the content has not scrolled past the header', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, headerHeightShared: { value: 80 }, scrollPosition: { value: -80 } })
      expect(lastTranslateY()).toBe(0)
      renderFooter({ footerFixed: false, footerHeight: 60, headerHeightShared: { value: 80 }, scrollPosition: { value: -100 } })
      expect(lastTranslateY()).toBe(0)
    })

    it('slides down by the distance scrolled past the header', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, headerHeightShared: { value: 80 }, scrollPosition: { value: -50 } })
      expect(lastTranslateY()).toBe(30)
    })

    it('never slides further than the footer is tall', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, headerHeightShared: { value: 80 }, scrollPosition: { value: 500 } })
      expect(lastTranslateY()).toBe(60)
    })

    it('discounts the pull-search height from the distance scrolled', () => {
      renderFooter({ footerFixed: false, footerHeight: 100, headerHeightShared: { value: 50 }, pullSearchHeightShared: { value: 20 }, scrollPosition: { value: 30 } })
      expect(lastTranslateY()).toBe(60)
    })

    it('treats an unmeasured footer as 0 tall', () => {
      renderFooter({ footerFixed: false, footerHeight: null, scrollPosition: { value: 40 } })
      expect(lastTranslateY()).toBe(0)
    })

    it('ignores footerOffset and the stack height', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, footerOffset: { value: 25 }, scrollPosition: { value: 10 }, stackHeightShared: { value: 5 } })
      expect(lastTranslateY()).toBe(10)
    })
  })

  describe('with snap-back', () => {
    it('follows footerOffset directly', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, footerOffset: { value: 25 }, snapBackFooterShared: { value: true } })
      expect(lastTranslateY()).toBe(25)
    })

    it('is not clamped to the stack height (the scroll handler already clamps it)', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, footerOffset: { value: 75 }, snapBackFooterShared: { value: true }, stackHeightShared: { value: 10 } })
      expect(lastTranslateY()).toBe(75)
    })

    it('ignores the scroll position', () => {
      renderFooter({ footerFixed: false, footerHeight: 60, footerOffset: { value: 0 }, scrollPosition: { value: 300 }, snapBackFooterShared: { value: true } })
      expect(lastTranslateY()).toBe(0)
    })
  })
})

describe('ScrollViewFooter translate (hosted)', () => {
  const STACK = 100
  const hosted = (overrides: Record<string, unknown> = {}) => ({ chromeHosted: true, footerFixed: false, stackHeightShared: { value: STACK }, ...overrides })

  it('translates by the shared offset', () => {
    renderFooter(hosted({ footerOffset: { value: 40 } }))
    expect(lastTranslateY()).toBe(40)
  })

  it('clamps the offset to the stack height', () => {
    renderFooter(hosted({ footerOffset: { value: STACK + 50 } }))
    expect(lastTranslateY()).toBe(STACK)
  })

  it('clamps a negative offset (an overscroll bounce) to 0', () => {
    renderFooter(hosted({ footerOffset: { value: -25 } }))
    expect(lastTranslateY()).toBe(0)
  })

  it('reads the offset straight through even when footerFixed is on (Footer Lock reveals via the offset instead)', () => {
    renderFooter(hosted({ footerFixed: true, footerOffset: { value: 40 } }))
    expect(lastTranslateY()).toBe(40)
  })

  it('still clamps to the stack height when footerFixed is on', () => {
    renderFooter(hosted({ footerFixed: true, footerOffset: { value: STACK + 50 } }))
    expect(lastTranslateY()).toBe(STACK)
  })

  it('ignores the unhosted scroll-driven paths, snap-back flag or not', () => {
    renderFooter(hosted({ footerHeight: 60, footerOffset: { value: 15 }, scrollPosition: { value: 500 }, snapBackFooterShared: { value: false } }))
    expect(lastTranslateY()).toBe(15)
    renderFooter(hosted({ footerHeight: 60, footerOffset: { value: 15 }, scrollPosition: { value: 500 }, snapBackFooterShared: { value: true } }))
    expect(lastTranslateY()).toBe(15)
  })
})

describe('ScrollViewFooter geometry', () => {
  const FOOTPRINT = 82
  const OVERHANG = 8
  const hosted = (overrides: Record<string, unknown> = {}) => ({ chromeHosted: true, chromeOverhang: OVERHANG, stackHeightShared: { value: 200 }, tabBarHeight: FOOTPRINT, ...overrides })

  describe('unhosted', () => {
    it('sits at the bottom of the screen by default', () => {
      renderFooter({ footerFixed: false })
      expect(lastBottom()).toBe(0)
    })

    it('clears a consumer tab bar by tabBarHeight', () => {
      renderFooter({ footerFixed: false, tabBarHeight: 60 })
      expect(lastBottom()).toBe(60)
    })

    it('does not shrink that clearance as the keyboard rises, floating or not', () => {
      renderFooter({ footerAboveKeyboard: true, footerFixed: true, tabBarHeight: 60 })
      openKeyboard(KEYBOARD_HEIGHT)
      expect(lastBottom()).toBe(60)
    })

    it('uses the safe-area inset (not chromeOverhang) for the row padding, even if a stale overhang is present', () => {
      renderFooter({ chromeOverhang: OVERHANG, footerFixed: false })
      expect(lastRowPaddingBottom()).toBe(SAFE_AREA_BOTTOM)
    })
  })

  describe('hosted', () => {
    it('sits above the bar: bottom is the footprint', () => {
      renderFooter(hosted({ footerFixed: false }))
      expect(lastBottom()).toBe(FOOTPRINT)
    })

    it('pads its row by the overhang instead of the safe-area inset', () => {
      renderFooter(hosted({ footerFixed: false }))
      expect(lastRowPaddingBottom()).toBe(OVERHANG)
    })

    it('adds a consumer style paddingBottom on top of the overhang', () => {
      renderFooter(hosted({ footerFixed: false }), { paddingBottom: 4 })
      expect(lastRowPaddingBottom()).toBe(OVERHANG + 4)
    })

    it('pads by 0 when the host has no overhang', () => {
      renderFooter(hosted({ chromeOverhang: 0, footerFixed: false }))
      expect(lastRowPaddingBottom()).toBe(0)
    })

    it('keeps the footprint as its bottom with the keyboard open when it is not floating', () => {
      renderFooter(hosted({ footerAboveKeyboard: false, footerFixed: true }))
      openKeyboard(KEYBOARD_HEIGHT)
      expect(lastBottom()).toBe(FOOTPRINT)
      expect(lastRowPaddingBottom()).toBe(OVERHANG)
    })

    it('keeps the footprint as its bottom when footerAboveKeyboard is set but the footer is not fixed', () => {
      renderFooter(hosted({ footerAboveKeyboard: true, footerFixed: false }))
      openKeyboard(KEYBOARD_HEIGHT)
      expect(lastBottom()).toBe(FOOTPRINT)
      expect(lastContainerPaddingBottom()).toBe(0)
    })

    describe('fixed and floating above the keyboard', () => {
      it('still clears the whole bar while the keyboard is closed', () => {
        renderFooter(hosted({ footerAboveKeyboard: true, footerFixed: true }))
        expect(lastBottom()).toBe(FOOTPRINT)
        expect(lastRowPaddingBottom()).toBe(OVERHANG)
      })

      it('shrinks the footprint away as the keyboard rises: bottom = max(footprint - keyboard, 0)', () => {
        renderFooter(hosted({ footerAboveKeyboard: true, footerFixed: true }))
        openKeyboard(30)
        expect(lastBottom()).toBe(FOOTPRINT - 30)
        openKeyboard(FOOTPRINT)
        expect(lastBottom()).toBe(0)
      })

      it('bottoms out at 0 once the keyboard is taller than the footprint', () => {
        renderFooter(hosted({ footerAboveKeyboard: true, footerFixed: true }))
        openKeyboard(KEYBOARD_HEIGHT)
        expect(lastBottom()).toBe(0)
      })

      it('grows the container by the keyboard height and drops the overhang padding once it is taller than it', () => {
        renderFooter(hosted({ footerAboveKeyboard: true, footerFixed: true }))
        openKeyboard(KEYBOARD_HEIGHT)
        expect(lastContainerPaddingBottom()).toBe(KEYBOARD_HEIGHT)
        expect(lastRowPaddingBottom()).toBe(0)
      })

      it('ramps the overhang padding down continuously through the keyboard rise, like the safe-area ramp', () => {
        renderFooter(hosted({ footerAboveKeyboard: true, footerFixed: true }))
        openKeyboard(3)
        expect(lastRowPaddingBottom()).toBe(OVERHANG - 3)
        openKeyboard(OVERHANG)
        expect(lastRowPaddingBottom()).toBe(0)
      })
    })
  })
})

describe('ScrollViewFooter layout', () => {
  const layoutEvent = (height: number) => ({ nativeEvent: { layout: { height, width: 390, x: 0, y: 0 } } }) as LayoutChangeEvent

  it('reports a measured height through setFooterHeight', () => {
    const setFooterHeight = jest.fn()
    renderFooter({ footerHeight: null, setFooterHeight })
    act(() => lastFooterProps().onLayout(layoutEvent(80)))
    expect(setFooterHeight).toHaveBeenCalledWith(80)
  })

  it('does not re-report a height that has not changed', () => {
    const setFooterHeight = jest.fn()
    renderFooter({ footerHeight: 80, setFooterHeight })
    act(() => lastFooterProps().onLayout(layoutEvent(80)))
    expect(setFooterHeight).not.toHaveBeenCalled()
  })

  it('reports null (no footer mounted) when it unmounts', () => {
    const setFooterHeight = jest.fn()
    const view = renderFooter({ setFooterHeight })
    expect(setFooterHeight).not.toHaveBeenCalled()
    view.unmount()
    expect(setFooterHeight).toHaveBeenCalledWith(null)
  })
})

describe('ScrollViewFooter web pre-paint measurement', () => {
  const originalOS = Platform.OS
  const mockView = jest.mocked(View)
  // The row View is the one ScrollViewFooter hands a ref; give it a real-looking DOM height the way
  // react-native-web's host node would. React 19 passes `ref` to function components as a plain
  // prop, so the mocked View can fill it in during render, before layout effects run.
  const withDomHeight = (offsetHeight: number) =>
    mockView.mockImplementation(((props: { children?: React.ReactNode; ref?: { current: unknown } }) => {
      if (props.ref && typeof props.ref === 'object') props.ref.current = { offsetHeight }
      return props.children ?? null
    }) as never)
  let ctx: ScrollViewContextType | undefined
  const Reader = () => {
    ctx = React.useContext(ScrollViewContext)
    return null
  }
  beforeEach(() => {
    Platform.OS = 'web' as typeof Platform.OS
    ctx = undefined
  })
  afterEach(() => {
    Platform.OS = originalOS
    mockView.mockImplementation(((props: { children?: React.ReactNode }) => props.children ?? null) as never)
  })

  it('commits the measured height before the first paint, so the backdrop and list reserve are there from frame one', () => {
    withDomHeight(43)
    render(
      <ScrollViewProvider>
        <ScrollViewFooter />
        <Reader />
      </ScrollViewProvider>
    )
    // render() returns only after the layout-effect update has re-rendered synchronously, i.e.
    // before the browser could have painted the unmeasured pass.
    expect(ctx!.footerHeight).toBe(43)
  })

  it('leaves a node with no layout box (hidden ancestor) to onLayout', () => {
    withDomHeight(0)
    render(
      <ScrollViewProvider>
        <ScrollViewFooter />
        <Reader />
      </ScrollViewProvider>
    )
    expect(ctx!.footerHeight).toBeNull()
  })

  it('does nothing on native, where onLayout is reliable', () => {
    Platform.OS = 'ios'
    withDomHeight(43)
    render(
      <ScrollViewProvider>
        <ScrollViewFooter />
        <Reader />
      </ScrollViewProvider>
    )
    expect(ctx!.footerHeight).toBeNull()
  })
})
