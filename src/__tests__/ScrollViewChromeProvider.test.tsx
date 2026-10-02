import { act, render } from '@testing-library/react'
import { createContext, useContext } from 'react'

import { type ScrollViewChrome, ScrollViewChromeContext, type ScrollViewChromeHost, ScrollViewChromeHostContext } from '../ScrollViewChromeContext'
import { ScrollViewChromeProvider, type ScrollViewChromeProviderProps } from '../ScrollViewChromeProvider'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { ScrollViewProvider, type ScrollViewProviderProps } from '../ScrollViewProvider'

const FOOTPRINT = 50

// Per-screen focus, the way react-navigation's useIsFocused would supply it: each screen wraps its
// own ScrollViewProvider in a FocusContext value, and the host's injected useIsActive (which the
// ChromeRegistrar calls from inside that provider) reads it back. Module-level so the reference is
// stable, as the host requires.
const FocusContext = createContext(true)
const useFocused = () => useContext(FocusContext)

type Captured = { chrome: ScrollViewChrome | null; host: ScrollViewChromeHost | null }
type Slot = { chrome: ScrollViewChrome | null; ctx: ScrollViewContextType | null; host: ScrollViewChromeHost | null }

const newCaptured = (): Captured => ({ chrome: null, host: null })
const newSlot = (): Slot => ({ chrome: null, ctx: null, host: null })

// Sits directly under the ChromeProvider (NOT under a ScrollViewProvider), so it sees the host the
// way a bar or a claim-machinery test would.
const RootProbe = ({ into }: { into: Captured }) => {
  into.chrome = useContext(ScrollViewChromeContext)
  into.host = useContext(ScrollViewChromeHostContext)
  return null
}

// Sits under a ScrollViewProvider, so it sees what that provider re-provides to its children.
const ScreenProbe = ({ into }: { into: Slot }) => {
  into.chrome = useContext(ScrollViewChromeContext)
  into.ctx = useContext(ScrollViewContext)
  into.host = useContext(ScrollViewChromeHostContext)
  return null
}

type ScreenProps = Omit<ScrollViewProviderProps, 'children'>

const Screen = ({ focused, into, props }: { focused: boolean; into: Slot; props?: ScreenProps }) => (
  <FocusContext.Provider value={focused}>
    <ScrollViewProvider {...props}>
      <ScreenProbe into={into} />
    </ScrollViewProvider>
  </FocusContext.Provider>
)

type TreeProps = {
  a: Slot
  aFocused?: boolean
  aProps?: ScreenProps
  b: Slot
  bFocused?: boolean
  providerProps?: Partial<ScrollViewChromeProviderProps>
  root: Captured
  showA?: boolean
  showB?: boolean
}

const Tree = ({ a, aFocused = true, aProps, b, bFocused = true, providerProps, root, showA = true, showB = false }: TreeProps) => (
  <ScrollViewChromeProvider footprint={FOOTPRINT} useIsActive={useFocused} {...providerProps}>
    <RootProbe into={root} />
    {showA ? <Screen focused={aFocused} into={a} props={aProps} /> : null}
    {showB ? <Screen focused={bFocused} into={b} /> : null}
  </ScrollViewChromeProvider>
)

const setup = (initial: Partial<TreeProps> = {}) => {
  const root = newCaptured()
  const a = newSlot()
  const b = newSlot()
  let current: Partial<TreeProps> = initial
  const view = render(<Tree a={a} b={b} root={root} {...current} />)
  const update = (next: Partial<TreeProps>) => {
    current = { ...current, ...next }
    view.rerender(<Tree a={a} b={b} root={root} {...current} />)
  }
  return { a, b, root, unmount: view.unmount, update }
}

// The offset a hidden stack is parked at, as a scroll handler would have left it.
const HIDDEN = 30

describe('ScrollViewChromeProvider claims', () => {
  it('claims the host on mount when useIsActive is true', () => {
    const { a, root } = setup()
    expect(root.host?.activeId).not.toBeNull()
    expect(a.ctx?.chromeWritable.value).toBe(true)
  })

  it('does not claim the host when useIsActive is false', () => {
    const { a, root } = setup({ aFocused: false })
    expect(root.host?.activeId).toBeNull()
    expect(a.ctx?.chromeWritable.value).toBe(false)
  })

  it('treats every screen as active when no useIsActive is injected', () => {
    const { a, root } = setup({ providerProps: { useIsActive: undefined } })
    expect(root.host?.activeId).not.toBeNull()
    expect(a.ctx?.chromeWritable.value).toBe(true)
  })

  it('lets the last claimant win when two hosted providers are active', () => {
    const { a, b } = setup({ showB: true })
    expect(b.ctx?.chromeWritable.value).toBe(true)
    expect(a.ctx?.chromeWritable.value).toBe(false)
  })

  it('hands the host to the earlier claimant when the winner blurs, and back when it refocuses', () => {
    const { a, b, update } = setup({ showB: true })
    update({ bFocused: false })
    expect(a.ctx?.chromeWritable.value).toBe(true)
    expect(b.ctx?.chromeWritable.value).toBe(false)
    update({ bFocused: true })
    expect(b.ctx?.chromeWritable.value).toBe(true)
    expect(a.ctx?.chromeWritable.value).toBe(false)
  })

  it('makes a provider that re-focuses the newest claim, ahead of one that never left', () => {
    const { a, b, update } = setup({ showB: true })
    update({ aFocused: false })
    // b kept the claim throughout; a was released while b owned it.
    expect(b.ctx?.chromeWritable.value).toBe(true)
    update({ aFocused: true })
    expect(a.ctx?.chromeWritable.value).toBe(true)
    expect(b.ctx?.chromeWritable.value).toBe(false)
  })

  it('releases the claim when the owning provider unmounts, handing the host back', () => {
    const { a, root, update } = setup({ showB: true })
    update({ showB: false })
    expect(a.ctx?.chromeWritable.value).toBe(true)
    expect(root.host?.activeId).not.toBeNull()
  })

  it('leaves the host unclaimed once every provider has blurred or unmounted', () => {
    const { root, update } = setup({ showB: true })
    update({ bFocused: false })
    update({ aFocused: false })
    expect(root.host?.activeId).toBeNull()
    update({ showA: false, showB: false })
    expect(root.host?.activeId).toBeNull()
  })

  // claim()/release() are the public face of the machinery a custom registrar would drive, so their
  // own ordering rules are pinned directly rather than only through ChromeRegistrar.
  describe('claim() / release()', () => {
    it('makes the most recent claim the active one', () => {
      const { root } = setup({ showA: false })
      act(() => root.host?.claim('x'))
      expect(root.host?.activeId).toBe('x')
      act(() => root.host?.claim('y'))
      expect(root.host?.activeId).toBe('y')
    })

    it('moves a repeated claim to the top instead of stacking a duplicate', () => {
      const { root } = setup({ showA: false })
      act(() => root.host?.claim('x'))
      act(() => root.host?.claim('y'))
      act(() => root.host?.claim('x'))
      expect(root.host?.activeId).toBe('x')
      // A single release of x must fully remove it — a duplicate would leave x active.
      act(() => root.host?.release('x'))
      expect(root.host?.activeId).toBe('y')
    })

    it('falls back to the previous claim when the top one releases, and to null when none are left', () => {
      const { root } = setup({ showA: false })
      act(() => root.host?.claim('x'))
      act(() => root.host?.claim('y'))
      act(() => root.host?.release('y'))
      expect(root.host?.activeId).toBe('x')
      act(() => root.host?.release('x'))
      expect(root.host?.activeId).toBeNull()
    })

    it('ignores releasing a claim that was never made, and one that is buried under the active claim', () => {
      const { root } = setup({ showA: false })
      act(() => root.host?.claim('x'))
      act(() => root.host?.claim('y'))
      act(() => root.host?.release('nope'))
      expect(root.host?.activeId).toBe('y')
      act(() => root.host?.release('x'))
      expect(root.host?.activeId).toBe('y')
    })
  })
})

describe('ScrollViewChromeProvider offset', () => {
  it('starts fully revealed', () => {
    const { root } = setup({ showA: false })
    expect(root.chrome?.offset.value).toBe(0)
  })

  it('reveals (resets to 0) every time the owner of the host changes', () => {
    const { root, update } = setup()
    const offset = root.chrome!.offset

    offset.value = HIDDEN
    update({ showB: true }) // b claims
    expect(offset.value).toBe(0)

    offset.value = HIDDEN
    update({ bFocused: false }) // b blurs, a is owner again
    expect(offset.value).toBe(0)

    offset.value = HIDDEN
    update({ aFocused: false }) // nobody owns it
    expect(offset.value).toBe(0)

    offset.value = HIDDEN
    update({ aFocused: true }) // a takes it back
    expect(offset.value).toBe(0)
  })

  it('does not reveal on a re-render that changes neither the owner nor the pins', () => {
    const { root, update } = setup()
    root.chrome!.offset.value = HIDDEN
    update({})
    expect(root.chrome?.offset.value).toBe(HIDDEN)
  })

  it('reveals when a pin engages', () => {
    const { root } = setup()
    root.chrome!.offset.value = HIDDEN
    act(() => root.chrome?.addPin())
    expect(root.chrome?.offset.value).toBe(0)
  })

  it('reveal() animates the offset back to 0', () => {
    const { root } = setup()
    root.chrome!.offset.value = HIDDEN
    act(() => root.chrome?.reveal())
    expect(root.chrome?.offset.value).toBe(0)
  })

  it('shares ONE offset between the public context, the host, and every hosted screen', () => {
    const { a, b, root } = setup({ showB: true })
    expect(root.host?.offset).toBe(root.chrome?.offset)
    expect(a.ctx?.footerOffset).toBe(root.chrome?.offset)
    expect(b.ctx?.footerOffset).toBe(root.chrome?.offset)
  })
})

describe('ScrollViewChromeProvider pins', () => {
  it('reports pinned while at least one pin is held', () => {
    const { root } = setup()
    expect(root.host?.pinned).toBe(false)
    act(() => root.chrome?.addPin())
    expect(root.host?.pinned).toBe(true)
    act(() => root.chrome?.removePin())
    expect(root.host?.pinned).toBe(false)
  })

  it('ref-counts pins: two pinners, one unpinning, is still pinned', () => {
    const { a, root } = setup()
    act(() => root.chrome?.addPin())
    act(() => root.chrome?.addPin())
    act(() => root.chrome?.removePin())
    expect(root.host?.pinned).toBe(true)
    expect(a.ctx?.chromeWritable.value).toBe(false)
    act(() => root.chrome?.removePin())
    expect(root.host?.pinned).toBe(false)
    expect(a.ctx?.chromeWritable.value).toBe(true)
  })

  it('never lets the pin count go negative, so a stray removePin does not cancel a later pin', () => {
    const { root } = setup()
    act(() => root.chrome?.removePin())
    act(() => root.chrome?.addPin())
    expect(root.host?.pinned).toBe(true)
    act(() => root.chrome?.removePin())
    expect(root.host?.pinned).toBe(false)
  })

  it('stops the owning screen writing the offset while pinned', () => {
    const { a, root } = setup()
    expect(a.ctx?.chromeWritable.value).toBe(true)
    act(() => root.chrome?.addPin())
    expect(a.ctx?.chromeWritable.value).toBe(false)
  })
})

describe('ScrollViewChromeProvider contexts', () => {
  it('exposes footprint, overhang and snapBack on both contexts with sensible defaults', () => {
    const { root } = setup({ showA: false })
    expect(root.host).toMatchObject({ footprint: FOOTPRINT, overhang: 0, snapBack: true })
    expect(root.chrome).toMatchObject({ footprint: FOOTPRINT, overhang: 0 })
  })

  it('passes a custom overhang and snapBack through', () => {
    const { root } = setup({ providerProps: { overhang: 8, snapBack: false }, showA: false })
    expect(root.host).toMatchObject({ overhang: 8, snapBack: false })
    expect(root.chrome?.overhang).toBe(8)
  })

  it('keeps the host and chrome values referentially stable across unrelated re-renders', () => {
    const { root, update } = setup()
    const { chrome, host } = root
    update({})
    expect(root.host).toBe(host)
    expect(root.chrome).toBe(chrome)
  })

  it('publishes a fresh host when its geometry changes', () => {
    const { root, update } = setup()
    const host = root.host
    update({ providerProps: { overhang: 12 } })
    expect(root.host).not.toBe(host)
    expect(root.host?.overhang).toBe(12)
    expect(root.chrome?.overhang).toBe(12)
  })

  it('clears the claim machinery below a ScrollViewProvider but keeps the public chrome', () => {
    const { a, root } = setup()
    expect(root.host).not.toBeNull()
    expect(a.host).toBeNull()
    expect(a.chrome).toBe(root.chrome)
  })
})

// Footer Lock (footerFixed) makes the scroll handlers stop writing the offset, so a stack that was
// hidden would otherwise stay hidden with nothing left to bring it back.
describe('ScrollViewChromeProvider with Footer Lock', () => {
  it('reveals a hidden stack when the owning screen turns footerFixed on', () => {
    const { root, update } = setup({ aProps: { footerFixed: false } })
    root.chrome!.offset.value = HIDDEN
    update({ aProps: { footerFixed: true } })
    expect(root.chrome?.offset.value).toBe(0)
  })

  it('reveals when the fixed prop (which locks both bars) turns on', () => {
    const { root, update } = setup({ aProps: { fixed: false } })
    root.chrome!.offset.value = HIDDEN
    update({ aProps: { fixed: true } })
    expect(root.chrome?.offset.value).toBe(0)
  })

  it('does not reveal for a screen that does not own the host', () => {
    const { root, update } = setup({ aFocused: false, aProps: { footerFixed: false } })
    root.chrome!.offset.value = HIDDEN
    update({ aProps: { footerFixed: true } })
    expect(root.chrome?.offset.value).toBe(HIDDEN)
  })

  it('does not reveal when footerFixed turns off again', () => {
    const { root, update } = setup({ aProps: { footerFixed: true } })
    root.chrome!.offset.value = HIDDEN
    update({ aProps: { footerFixed: false } })
    expect(root.chrome?.offset.value).toBe(HIDDEN)
  })
})
