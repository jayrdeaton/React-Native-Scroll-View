import { renderHook } from '@testing-library/react'
import React from 'react'
import type { SharedValue } from 'react-native-reanimated'

import { useScrollHandlerJS } from '../internal/useScrollHandlerJS'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'

const REMOUNT_RETRY_MAX_ATTEMPTS = 8

const buildContextValue = (): ScrollViewContextType =>
  ({
    footerHeightShared: { value: 0 },
    footerOffset: { value: 0 },
    headerHeightShared: { value: 0 },
    headerOffset: { value: 0 },
    pullSearchHeightShared: { value: 0 },
    scrollPosition: { value: 0 },
    snapBackFooterShared: { value: false },
    snapBackHeaderShared: { value: false }
  }) as unknown as ScrollViewContextType

const scrollEvent = (y: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { height: 1000, width: 0 },
      layoutMeasurement: { height: 500, width: 0 }
    }
  }) as never

const renderScrollHandlerJS = (overrides: Partial<Parameters<typeof useScrollHandlerJS>[0]> = {}) => {
  const contextValue = buildContextValue()
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
