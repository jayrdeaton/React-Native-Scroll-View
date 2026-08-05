import { act, render } from '@testing-library/react'
import React from 'react'
import { View } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import Animated from 'react-native-reanimated'

import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { ScrollViewFooter } from '../ScrollViewFooter'

const SAFE_AREA_BOTTOM = 34
const KEYBOARD_HEIGHT = 300

const buildContextValue = (overrides: Partial<ScrollViewContextType> = {}): ScrollViewContextType =>
  ({
    blur: false,
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
    ...overrides
  }) as unknown as ScrollViewContextType

const renderFooter = (overrides: Partial<ScrollViewContextType>) => {
  const contextValue = buildContextValue(overrides)
  return render(
    <ScrollViewContext.Provider value={contextValue}>
      <ScrollViewFooter />
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
