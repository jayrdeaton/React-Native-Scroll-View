import { act, render, renderHook } from '@testing-library/react'
import { type ReactNode, useContext } from 'react'

import { type ScrollViewChrome, ScrollViewChromeContext, type ScrollViewChromeHost, ScrollViewChromeHostContext } from '../ScrollViewChromeContext'
import { ScrollViewChromeProvider } from '../ScrollViewChromeProvider'
import { useScrollViewChromePin, useScrollViewChromeReveal, useScrollViewChromeStyle } from '../useScrollViewChrome'

const FOOTPRINT = 50
const HIDDEN = 30

const Host = ({ children }: { children: ReactNode }) => <ScrollViewChromeProvider footprint={FOOTPRINT}>{children}</ScrollViewChromeProvider>

// useAnimatedStyle's result is opaque to the real types; the mock returns the factory's plain
// object, which is what these tests read.
const translateYOf = (style: unknown) => (style as { transform: { translateY: number }[] }).transform[0].translateY

describe('useScrollViewChromeStyle', () => {
  it('translates by the shared offset of the host, following it as it moves and back to 0 on reveal', () => {
    const { rerender, result } = renderHook(
      () => ({
        chrome: useContext(ScrollViewChromeContext),
        style: useScrollViewChromeStyle()
      }),
      { wrapper: Host }
    )
    expect(translateYOf(result.current.style)).toBe(0)
    result.current.chrome!.offset.value = HIDDEN
    rerender()
    expect(translateYOf(result.current.style)).toBe(HIDDEN)
    act(() => result.current.chrome?.reveal())
    rerender()
    expect(translateYOf(result.current.style)).toBe(0)
  })

  it('is a permanent zero translate outside any host', () => {
    const { rerender, result } = renderHook(() => useScrollViewChromeStyle())
    expect(translateYOf(result.current)).toBe(0)
    rerender()
    expect(translateYOf(result.current)).toBe(0)
  })
})

describe('useScrollViewChromePin', () => {
  const usePinWithHost = (active: boolean) => {
    useScrollViewChromePin(active)
    return useContext(ScrollViewChromeHostContext)
  }

  it('pins the host while active and releases when it turns inactive', () => {
    const { rerender, result } = renderHook(({ active }) => usePinWithHost(active), { initialProps: { active: false }, wrapper: Host })
    expect(result.current?.pinned).toBe(false)
    rerender({ active: true })
    expect(result.current?.pinned).toBe(true)
    rerender({ active: false })
    expect(result.current?.pinned).toBe(false)
  })

  it('releases its pin when the pinning component unmounts', () => {
    const host: { current: ScrollViewChromeHost | null } = { current: null }
    const Probe = () => {
      host.current = useContext(ScrollViewChromeHostContext)
      return null
    }
    const Pinner = () => {
      useScrollViewChromePin(true)
      return null
    }
    const view = render(
      <Host>
        <Probe />
        <Pinner />
      </Host>
    )
    expect(host.current?.pinned).toBe(true)
    view.rerender(
      <Host>
        <Probe />
      </Host>
    )
    expect(host.current?.pinned).toBe(false)
  })

  it('ref-counts across independent pinners: one unpinning does not release the other', () => {
    const host: { current: ScrollViewChromeHost | null } = { current: null }
    const Probe = () => {
      host.current = useContext(ScrollViewChromeHostContext)
      return null
    }
    const Pinner = () => {
      useScrollViewChromePin(true)
      return null
    }
    const view = render(
      <Host>
        <Probe />
        <Pinner key='a' />
        <Pinner key='b' />
      </Host>
    )
    expect(host.current?.pinned).toBe(true)
    view.rerender(
      <Host>
        <Probe />
        <Pinner key='a' />
      </Host>
    )
    expect(host.current?.pinned).toBe(true)
    view.rerender(
      <Host>
        <Probe />
      </Host>
    )
    expect(host.current?.pinned).toBe(false)
  })

  it('reveals the bar when the pin engages', () => {
    const chrome: { current: ScrollViewChrome | null } = { current: null }
    const Probe = () => {
      chrome.current = useContext(ScrollViewChromeContext)
      return null
    }
    const Pinner = ({ active }: { active: boolean }) => {
      useScrollViewChromePin(active)
      return null
    }
    const view = render(
      <Host>
        <Probe />
        <Pinner active={false} />
      </Host>
    )
    chrome.current!.offset.value = HIDDEN
    view.rerender(
      <Host>
        <Probe />
        <Pinner active />
      </Host>
    )
    expect(chrome.current?.offset.value).toBe(0)
  })

  it('is inert outside a host, active or not', () => {
    expect(() => renderHook(() => useScrollViewChromePin(true))).not.toThrow()
    expect(() => renderHook(() => useScrollViewChromePin(false))).not.toThrow()
  })
})

describe('useScrollViewChromeReveal', () => {
  it('returns the host reveal, which animates the offset back to 0', () => {
    const { result } = renderHook(
      () => ({
        chrome: useContext(ScrollViewChromeContext),
        reveal: useScrollViewChromeReveal()
      }),
      { wrapper: Host }
    )
    expect(result.current.reveal).toBe(result.current.chrome?.reveal)
    result.current.chrome!.offset.value = HIDDEN
    act(() => result.current.reveal())
    expect(result.current.chrome?.offset.value).toBe(0)
  })

  it('is a noop outside a host, stable across renders', () => {
    const { rerender, result } = renderHook(() => useScrollViewChromeReveal())
    const first = result.current
    expect(typeof first).toBe('function')
    expect(first()).toBeUndefined()
    rerender()
    expect(result.current).toBe(first)
  })
})
