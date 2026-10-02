import { render } from '@testing-library/react'
import type { SharedValue } from 'react-native-reanimated'

import { ChromeRegistrar } from '../internal/ChromeRegistrar'
import type { ScrollViewChromeHost } from '../ScrollViewChromeContext'

// The host's injected focus hook. A jest.fn so each test can flip it between renders — it is called
// as a hook, on every render of the registrar, exactly like react-navigation's useIsFocused.
const useIsActive = jest.fn(() => true)

const buildHost = (overrides: Partial<ScrollViewChromeHost> = {}): ScrollViewChromeHost => ({
  activeId: null,
  claim: jest.fn(),
  footprint: 50,
  offset: { value: 0 } as unknown as SharedValue<number>,
  overhang: 0,
  pinned: false,
  release: jest.fn(),
  reveal: jest.fn(),
  snapBack: true,
  useIsActive,
  ...overrides
})

const buildWritable = () => ({ value: false }) as unknown as SharedValue<boolean>

// The registrar's id comes from React's useId, so a test learns it the same way the host does: from
// the claim() call.
const claimedId = (host: ScrollViewChromeHost) => (host.claim as jest.Mock).mock.calls[0][0] as string

describe('ChromeRegistrar claiming', () => {
  beforeEach(() => {
    useIsActive.mockReset()
    useIsActive.mockReturnValue(true)
  })

  it('claims the host on mount while active', () => {
    const host = buildHost()
    render(<ChromeRegistrar footerFixed={false} host={host} writable={buildWritable()} />)
    expect(host.claim).toHaveBeenCalledTimes(1)
    expect(typeof claimedId(host)).toBe('string')
  })

  it('does not claim while inactive', () => {
    useIsActive.mockReturnValue(false)
    const host = buildHost()
    render(<ChromeRegistrar footerFixed={false} host={host} writable={buildWritable()} />)
    expect(host.claim).not.toHaveBeenCalled()
    expect(host.release).not.toHaveBeenCalled()
  })

  it('releases the same id it claimed when it unmounts', () => {
    const host = buildHost()
    const view = render(<ChromeRegistrar footerFixed={false} host={host} writable={buildWritable()} />)
    view.unmount()
    expect(host.release).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledWith(claimedId(host))
  })

  it('releases when its screen blurs, and claims again when it refocuses', () => {
    const host = buildHost()
    const writable = buildWritable()
    const view = render(<ChromeRegistrar footerFixed={false} host={host} writable={writable} />)
    const id = claimedId(host)
    useIsActive.mockReturnValue(false)
    view.rerender(<ChromeRegistrar footerFixed={false} host={host} writable={writable} />)
    expect(host.release).toHaveBeenCalledWith(id)
    useIsActive.mockReturnValue(true)
    view.rerender(<ChromeRegistrar footerFixed={false} host={host} writable={writable} />)
    expect(host.claim).toHaveBeenCalledTimes(2)
    expect(host.claim).toHaveBeenLastCalledWith(id)
  })

  it('renders nothing', () => {
    const { container } = render(<ChromeRegistrar footerFixed={false} host={buildHost()} writable={buildWritable()} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('ChromeRegistrar writable', () => {
  beforeEach(() => {
    useIsActive.mockReset()
    useIsActive.mockReturnValue(true)
  })

  // Every scenario here first mounts unowned to learn the id, then re-renders with a host whose
  // activeId is that id (or not) — the same handoff ScrollViewChromeProvider's state update drives.
  const mountAndOwn = () => {
    const writable = buildWritable()
    const host = buildHost()
    const view = render(<ChromeRegistrar footerFixed={false} host={host} writable={writable} />)
    const id = claimedId(host)
    const rerenderWith = (next: Partial<ScrollViewChromeHost>, footerFixed = false) => view.rerender(<ChromeRegistrar footerFixed={footerFixed} host={{ ...host, ...next }} writable={writable} />)
    return { host, id, rerenderWith, writable }
  }

  it('is false while another screen (or nobody) owns the host', () => {
    const { rerenderWith, writable } = mountAndOwn()
    expect(writable.value).toBe(false)
    rerenderWith({ activeId: 'someone-else' })
    expect(writable.value).toBe(false)
  })

  it('is true once this registrar owns the host and nothing is pinned', () => {
    const { id, rerenderWith, writable } = mountAndOwn()
    rerenderWith({ activeId: id })
    expect(writable.value).toBe(true)
  })

  it('is false while pinned, even for the owner, and recovers when the pin is released', () => {
    const { id, rerenderWith, writable } = mountAndOwn()
    rerenderWith({ activeId: id })
    rerenderWith({ activeId: id, pinned: true })
    expect(writable.value).toBe(false)
    rerenderWith({ activeId: id, pinned: false })
    expect(writable.value).toBe(true)
  })

  it('drops back to false when ownership moves to another screen', () => {
    const { id, rerenderWith, writable } = mountAndOwn()
    rerenderWith({ activeId: id })
    expect(writable.value).toBe(true)
    rerenderWith({ activeId: 'someone-else' })
    expect(writable.value).toBe(false)
  })
})

describe('ChromeRegistrar Footer Lock reveal', () => {
  beforeEach(() => {
    useIsActive.mockReset()
    useIsActive.mockReturnValue(true)
  })

  const mountOwner = (footerFixed: boolean) => {
    const writable = buildWritable()
    const host = buildHost()
    const view = render(<ChromeRegistrar footerFixed={footerFixed} host={host} writable={writable} />)
    const id = claimedId(host)
    const owned = { ...host, activeId: id }
    view.rerender(<ChromeRegistrar footerFixed={footerFixed} host={owned} writable={writable} />)
    ;(host.reveal as jest.Mock).mockClear()
    const rerenderFixed = (next: boolean, target = owned) => view.rerender(<ChromeRegistrar footerFixed={next} host={target} writable={writable} />)
    return { host, id, owned, rerenderFixed, writable }
  }

  it('reveals when Footer Lock turns on while the registrar owns the host', () => {
    const { host, rerenderFixed } = mountOwner(false)
    rerenderFixed(true)
    expect(host.reveal).toHaveBeenCalledTimes(1)
  })

  it('does not reveal again on a re-render that leaves Footer Lock on', () => {
    const { host, rerenderFixed } = mountOwner(false)
    rerenderFixed(true)
    rerenderFixed(true)
    expect(host.reveal).toHaveBeenCalledTimes(1)
  })

  it('does not reveal when Footer Lock turns off', () => {
    const { host, rerenderFixed } = mountOwner(true)
    rerenderFixed(false)
    expect(host.reveal).not.toHaveBeenCalled()
  })

  it('does not reveal for a registrar that is not the owner', () => {
    const writable = buildWritable()
    const host = buildHost({ activeId: 'someone-else' })
    const view = render(<ChromeRegistrar footerFixed={false} host={host} writable={writable} />)
    view.rerender(<ChromeRegistrar footerFixed host={host} writable={writable} />)
    expect(host.reveal).not.toHaveBeenCalled()
  })

  it('reveals when a Footer Lock screen takes over the host, since the previous owner may have left it hidden', () => {
    const writable = buildWritable()
    const host = buildHost()
    const view = render(<ChromeRegistrar footerFixed host={host} writable={writable} />)
    expect(host.reveal).not.toHaveBeenCalled()
    view.rerender(<ChromeRegistrar footerFixed host={{ ...host, activeId: claimedId(host) }} writable={writable} />)
    expect(host.reveal).toHaveBeenCalledTimes(1)
  })
})
