import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { useKeyboardHandler } from 'react-native-keyboard-controller'

import { useScrollList } from '../internal/useScrollList'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'

const FOOTER_HEIGHT = 60
const KEYBOARD_HEIGHT = 300
const SAFE_AREA_BOTTOM = 34

const buildContextValue = (overrides: Partial<ScrollViewContextType> = {}): ScrollViewContextType =>
  ({
    blur: true,
    chromeHosted: false,
    chromeOverhang: 0,
    chromeWritable: { value: true },
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
    stackHeightShared: { value: FOOTER_HEIGHT },
    tabBarHeight: 0,
    ...overrides
  }) as unknown as ScrollViewContextType

const renderList = (contextOverrides: Partial<ScrollViewContextType>, keyboardAware: boolean, listOptions: { footerFixed?: boolean } = {}) => {
  const contextValue = buildContextValue(contextOverrides)
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(ScrollViewContext.Provider, { value: contextValue }, children)
  const rendered = renderHook(() => useScrollList({ keyboardAware, ...listOptions }), { wrapper })
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

// Hosted, tabBarHeight in the context is already the persistent bar's whole footprint (safe-area
// inset included), so the base reserve is only what pokes ABOVE the bar — chromeOverhang — and the
// safe-area inset must not be counted a second time.
describe('useScrollList bottom inset with a chrome host', () => {
  const FOOTPRINT = 82
  const OVERHANG = 8

  const renderHosted = (overrides: Partial<ScrollViewContextType> = {}, keyboardAware = false) => renderList({ chromeHosted: true, chromeOverhang: OVERHANG, tabBarHeight: FOOTPRINT, ...overrides }, keyboardAware)

  it('reserves overhang + footprint (not the safe-area inset) when there is no fixed footer', () => {
    const { result } = renderHosted({ footerFixed: false, footerHeight: null })
    expect(result.current.contentInset.bottom).toBe(OVERHANG + FOOTPRINT)
    expect(result.current.contentInset.bottom).not.toBe(SAFE_AREA_BOTTOM + FOOTPRINT)
  })

  it('reserves only the footprint when the host has no overhang', () => {
    const { result } = renderHosted({ chromeOverhang: 0, footerFixed: false, footerHeight: null })
    expect(result.current.contentInset.bottom).toBe(FOOTPRINT)
  })

  it('falls back to the overhang for a fixed footer that has not measured yet', () => {
    const { result } = renderHosted({ footerFixed: true, footerHeight: null })
    expect(result.current.contentInset.bottom).toBe(OVERHANG + FOOTPRINT)
  })

  it('does not count the overhang on top of a measured fixed footer, which already pads by it', () => {
    const { result } = renderHosted({ footerFixed: true, footerHeight: FOOTER_HEIGHT })
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT + FOOTPRINT)
  })

  // Unlike an unhosted footer (a pure function of scroll position, so scrolling to the end always
  // hides it), a hosted stack settles wherever the last gesture left it — a revealed footer at the end
  // of a list would cover the last rows if the reserve ignored it.
  it('reserves a measured footer even when it is not fixed, so a revealed footer never covers the last rows', () => {
    const { result } = renderHosted({ footerFixed: false, footerHeight: FOOTER_HEIGHT })
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT + FOOTPRINT)
  })

  it('never reserves less than the overhang, even for a footer measured shorter than it', () => {
    const { result } = renderHosted({ footerFixed: false, footerHeight: OVERHANG - 3 })
    expect(result.current.contentInset.bottom).toBe(OVERHANG + FOOTPRINT)
  })

  it('reserves the taller of overhang/keyboard, plus the footprint, when keyboard-aware', () => {
    const { result } = renderHosted({ footerFixed: false, footerHeight: null }, true)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(KEYBOARD_HEIGHT + FOOTPRINT)
  })

  it('keeps the overhang reserve when the keyboard is shorter than it', () => {
    const { result } = renderHosted({ footerFixed: false, footerHeight: null }, true)
    openKeyboard(OVERHANG - 1)
    expect(result.current.contentInset.bottom).toBe(OVERHANG + FOOTPRINT)
  })

  // ScrollViewFooter pins a hosted, keyboard-floating footer at max(footprint - keyboardHeight, 0):
  // the bar it was clearing is behind the keyboard, so the footprint shrinks away as the keyboard
  // rises, and the reserve has to shrink the same way or a blank band opens between list and footer.
  it('trusts the measured footer as-is when floating above a tall keyboard, with no footprint left to add', () => {
    const { result } = renderHosted({ footerAboveKeyboard: true, footerFixed: true, footerHeight: FOOTER_HEIGHT }, true)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT)
  })

  it('shrinks the footprint by the keyboard height while a floating footer is partly above the bar', () => {
    const { result } = renderHosted({ footerAboveKeyboard: true, footerFixed: true, footerHeight: FOOTER_HEIGHT }, true)
    openKeyboard(50)
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT + (FOOTPRINT - 50))
  })

  it('keeps the full footprint when the footer does not float above the keyboard', () => {
    const { result } = renderHosted({ footerAboveKeyboard: false, footerFixed: true, footerHeight: FOOTER_HEIGHT }, true)
    openKeyboard(50)
    expect(result.current.contentInset.bottom).toBe(Math.max(FOOTER_HEIGHT, 50) + FOOTPRINT)
  })

  it('ignores the keyboard entirely when keyboardAware is false', () => {
    const { result } = renderHosted({ footerFixed: false, footerHeight: null }, false)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(OVERHANG + FOOTPRINT)
  })

  it('keeps the top inset at the header height', () => {
    const { result } = renderHosted({ headerHeight: 80 })
    expect(result.current.contentInset.top).toBe(80)
  })
})

// A hosted footer and the bar share one offset that the provider's registrar reveals when the
// PROVIDER-level Footer Lock turns on; a per-list footerFixed override that switched the handlers
// off on its own would leave that shared offset stuck wherever it was hidden.
describe('useScrollList footerFixed resolution', () => {
  it('lets a per-list footerFixed override the context when unhosted (unchanged)', () => {
    const { result } = renderList({ chromeHosted: false, footerFixed: false }, false, { footerFixed: true })
    expect(result.current.footerFixed).toBe(true)
  })

  it('ignores a per-list footerFixed override when hosted and follows the context flag', () => {
    const { result } = renderList({ chromeHosted: true, footerFixed: false }, false, { footerFixed: true })
    expect(result.current.footerFixed).toBe(false)
  })

  it('follows the context flag when hosted and Footer Lock is on', () => {
    const { result } = renderList({ chromeHosted: true, footerFixed: true }, false, { footerFixed: false })
    expect(result.current.footerFixed).toBe(true)
  })
})

describe('useScrollList bottom inset without a chrome host', () => {
  it('reserves the safe-area inset as the base, plus the consumer tabBarHeight', () => {
    const { result } = renderList({ footerFixed: false, footerHeight: null, tabBarHeight: 20 }, false)
    expect(result.current.contentInset.bottom).toBe(SAFE_AREA_BOTTOM + 20)
  })

  it('ignores chromeOverhang when not hosted', () => {
    const { result } = renderList({ chromeHosted: false, chromeOverhang: 8, footerFixed: false, footerHeight: null, tabBarHeight: 0 }, false)
    expect(result.current.contentInset.bottom).toBe(SAFE_AREA_BOTTOM)
  })

  it('falls back to the safe-area inset for a fixed footer that has not measured yet', () => {
    const { result } = renderList({ footerFixed: true, footerHeight: null, tabBarHeight: 20 }, false)
    expect(result.current.contentInset.bottom).toBe(SAFE_AREA_BOTTOM + 20)
  })

  it('adds the consumer tabBarHeight on top of a measured fixed footer', () => {
    const { result } = renderList({ footerFixed: true, footerHeight: FOOTER_HEIGHT, tabBarHeight: 20 }, false)
    expect(result.current.contentInset.bottom).toBe(FOOTER_HEIGHT + 20)
  })

  it('reserves the taller of safe-area/keyboard, plus tabBarHeight, when keyboard-aware', () => {
    const { result } = renderList({ footerFixed: false, footerHeight: null, tabBarHeight: 20 }, true)
    openKeyboard(KEYBOARD_HEIGHT)
    expect(result.current.contentInset.bottom).toBe(KEYBOARD_HEIGHT + 20)
  })
})
