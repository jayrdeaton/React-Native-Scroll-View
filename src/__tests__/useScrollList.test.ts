import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { useKeyboardHandler } from 'react-native-keyboard-controller'

import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { useScrollList } from '../internal/useScrollList'

const FOOTER_HEIGHT = 60
const KEYBOARD_HEIGHT = 300
const SAFE_AREA_BOTTOM = 34

const buildContextValue = (overrides: Partial<ScrollViewContextType> = {}): ScrollViewContextType =>
  ({
    blur: true,
    footerAboveKeyboard: false,
    footerHeight: FOOTER_HEIGHT,
    footerHeightShared: { value: FOOTER_HEIGHT },
    footerFixed: true,
    footerOffset: { value: 0 },
    headerHeight: 80,
    headerHeightShared: { value: 80 },
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
    tabBarHeight: 0,
    ...overrides
  }) as unknown as ScrollViewContextType

const renderList = (contextOverrides: Partial<ScrollViewContextType>, keyboardAware: boolean) => {
  const contextValue = buildContextValue(contextOverrides)
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(ScrollViewContext.Provider, { value: contextValue }, children)
  const rendered = renderHook(() => useScrollList({ keyboardAware }), { wrapper })
  return rendered
}

// Drives useKeyboardInset's internal state the same way a real keyboard-show event would, by
// invoking the onMove handler this hook registered via useKeyboardHandler — see PullSearch.test.tsx
// for the same pattern applied to onLayout.
const openKeyboard = (height: number) => {
  const handlerMock = useKeyboardHandler as jest.Mock
  const { onMove } = handlerMock.mock.calls[handlerMock.mock.calls.length - 1][0]
  act(() => onMove({ height }))
}

describe('useScrollList bottom inset with a fixed footer', () => {
  it('ignores the keyboard entirely when keyboardAware is false', () => {
    const { result } = renderList({ footerFixed: true }, false)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT)
  })

  it('reserves only the taller of footer/keyboard by default (footer is hidden behind the keyboard)', () => {
    const { result } = renderList({ footerAboveKeyboard: false, footerFixed: true }, true)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(KEYBOARD_HEIGHT)
  })

  // ScrollViewFooter grows its own container by keyboardHeight to float (rather than translating a
  // fixed-height bar), so the footerHeight it reports via onLayout already bakes keyboardHeight in
  // — useScrollList must trust it as-is here, not add keyboardHeight again on top.
  it('trusts footerHeight as-is when footerAboveKeyboard opts the footer into floating above it', () => {
    const { result } = renderList({ footerAboveKeyboard: true, footerFixed: true }, true)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT)
  })

  it('ignores footerAboveKeyboard when the footer is not fixed (nothing floats)', () => {
    const { result } = renderList({ footerAboveKeyboard: true, footerFixed: false }, true)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(Math.max(SAFE_AREA_BOTTOM, KEYBOARD_HEIGHT))
  })
})
