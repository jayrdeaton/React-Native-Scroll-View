import { act, render } from '@testing-library/react'
import { useContext } from 'react'
import { Platform } from 'react-native'

import { type ScrollViewChrome, ScrollViewChromeContext, type ScrollViewChromeHost, ScrollViewChromeHostContext } from '../ScrollViewChromeContext'
import { ScrollViewChromeProvider, type ScrollViewChromeProviderProps } from '../ScrollViewChromeProvider'
import { ScrollViewContext, type ScrollViewContextType } from '../ScrollViewContext'
import { ScrollViewProvider, type ScrollViewProviderProps } from '../ScrollViewProvider'
import { useScrollView } from '../useScrollView'

const ContextReader = ({ onRead }: { onRead: (v: ReturnType<typeof useScrollView>) => void }) => {
  const value = useScrollView()
  onRead(value)
  return null
}

describe('ScrollViewProvider', () => {
  it('renders without crashing', () => {
    render(
      <ScrollViewProvider>
        <></>
      </ScrollViewProvider>
    )
  })

  it('provides default context values', () => {
    let capturedValue: ReturnType<typeof useScrollView> | undefined
    render(
      <ScrollViewProvider>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewProvider>
    )
    expect(capturedValue?.progress).toBeNull()
    expect(capturedValue?.progressing).toBe(false)
  })

  it('accepts headerFixed and footerFixed props', () => {
    let capturedCtx: { headerFixed: boolean; footerFixed: boolean } | undefined
    const Reader = () => {
      const ctx = useContext(ScrollViewContext)
      capturedCtx = { headerFixed: ctx.headerFixed, footerFixed: ctx.footerFixed }
      return null
    }
    render(
      <ScrollViewProvider headerFixed footerFixed>
        <Reader />
      </ScrollViewProvider>
    )
    expect(capturedCtx?.headerFixed).toBe(true)
    expect(capturedCtx?.footerFixed).toBe(true)
  })

  it('setProgress updates progress value', () => {
    let capturedValue: ReturnType<typeof useScrollView> | undefined
    const { rerender } = render(
      <ScrollViewProvider>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewProvider>
    )
    act(() => {
      capturedValue?.setProgress(0.5)
    })
    rerender(
      <ScrollViewProvider>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewProvider>
    )
    expect(capturedValue?.progress).toBe(0.5)
  })

  it('on web, falls back to headerHeight = 0 if no ScrollViewHeader ever reports a layout', async () => {
    const originalOS = Platform.OS
    Platform.OS = 'web' as typeof Platform.OS

    let capturedHeaderHeight: number | null | undefined
    const Reader = () => {
      const ctx = useContext(ScrollViewContext)
      capturedHeaderHeight = ctx.headerHeight
      return null
    }
    render(
      <ScrollViewProvider>
        <Reader />
      </ScrollViewProvider>
    )
    expect(capturedHeaderHeight).toBeNull()

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    expect(capturedHeaderHeight).toBe(0)

    Platform.OS = originalOS
  })

  // Reproduces the web race observed in a real app: the header's first onLayout and the web
  // fallback's setHeaderHeight(0) land in the same frame, both through a setter captured while
  // headerHeight was still null. The real height must survive the late 0.
  it("never lets a 0 from a stale setHeaderHeight overwrite a real height that hasn't committed yet", () => {
    let ctx: ScrollViewContextType | undefined
    const Reader = () => {
      ctx = useContext(ScrollViewContext)
      return null
    }
    render(
      <ScrollViewProvider>
        <Reader />
      </ScrollViewProvider>
    )
    const staleSetHeaderHeight = ctx!.setHeaderHeight
    act(() => {
      staleSetHeaderHeight(129)
      staleSetHeaderHeight(0)
    })
    expect(ctx!.headerHeight).toBe(129)
    expect(ctx!.headerHeightShared.value).toBe(129)
  })

  it('end to end on web: a header layout arriving just before the fallback fires keeps its real height', async () => {
    const originalOS = Platform.OS
    Platform.OS = 'web' as typeof Platform.OS
    let ctx: ScrollViewContextType | undefined
    const Reader = () => {
      ctx = useContext(ScrollViewContext)
      return null
    }
    // Hold rAF callbacks so the measurement can be delivered between the fallback's two frames,
    // with no commit in between — exactly the ordering a real browser produced.
    const queued: FrameRequestCallback[] = []
    const rafSpy = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => queued.push(cb))
    try {
      render(
        <ScrollViewProvider>
          <Reader />
        </ScrollViewProvider>
      )
      const staleSetHeaderHeight = ctx!.setHeaderHeight
      act(() => {
        queued.shift()!(0) // fallback frame 1 schedules frame 2
        staleSetHeaderHeight(129) // the real onLayout
        queued.shift()!(0) // fallback frame 2: setHeaderHeight(0) through the same stale closure
      })
      expect(ctx!.headerHeight).toBe(129)
    } finally {
      rafSpy.mockRestore()
      Platform.OS = originalOS
    }
  })

  it("never lets a 0 from a stale setFooterHeight overwrite a real height that hasn't committed yet", () => {
    let ctx: ScrollViewContextType | undefined
    const Reader = () => {
      ctx = useContext(ScrollViewContext)
      return null
    }
    render(
      <ScrollViewProvider>
        <Reader />
      </ScrollViewProvider>
    )
    const staleSetFooterHeight = ctx!.setFooterHeight
    act(() => {
      staleSetFooterHeight(43)
      staleSetFooterHeight(0)
    })
    expect(ctx!.footerHeight).toBe(43)
    expect(ctx!.footerHeightShared.value).toBe(43)
  })

  it('still lets an explicit null reset a known height, and a 0 apply after that', () => {
    let ctx: ScrollViewContextType | undefined
    const Reader = () => {
      ctx = useContext(ScrollViewContext)
      return null
    }
    render(
      <ScrollViewProvider>
        <Reader />
      </ScrollViewProvider>
    )
    act(() => ctx!.setHeaderHeight(129))
    act(() => ctx!.setHeaderHeight(null))
    expect(ctx!.headerHeight).toBeNull()
    act(() => ctx!.setHeaderHeight(0))
    expect(ctx!.headerHeight).toBe(0)
  })

  it('does not apply the web-only fallback on native, so a truly missing header stays null', async () => {
    expect(Platform.OS).toBe('ios')

    let capturedHeaderHeight: number | null | undefined
    const Reader = () => {
      const ctx = useContext(ScrollViewContext)
      capturedHeaderHeight = ctx.headerHeight
      return null
    }
    render(
      <ScrollViewProvider>
        <Reader />
      </ScrollViewProvider>
    )

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    expect(capturedHeaderHeight).toBeNull()
  })
})

const FOOTPRINT = 50
const OVERHANG = 8
// Every hosted provider's own slack past the geometrically-required hide distance (see
// internal/chrome.ts's CHROME_SLACK) — repeated here as a literal so a change to it has to be a
// deliberate edit to these tests too.
const SLACK = 2

type ScreenProps = Omit<ScrollViewProviderProps, 'children'>
type Snapshot = { chrome: ScrollViewChrome | null; ctx: ScrollViewContextType | null; host: ScrollViewChromeHost | null }

const newSnapshot = (): Snapshot => ({ chrome: null, ctx: null, host: null })

// Reads everything a component below a ScrollViewProvider (or directly below the host) can see.
const Probe = ({ into }: { into: Snapshot }) => {
  into.chrome = useContext(ScrollViewChromeContext)
  into.ctx = useContext(ScrollViewContext)
  into.host = useContext(ScrollViewChromeHostContext)
  return null
}

// A ScrollViewProvider inside a ScrollViewChromeProvider. `root` is a probe directly under the host
// (it sees the un-cleared claim machinery); `screen` is a probe under the provider (it sees what the
// provider re-provides). `update` re-renders the SAME tree with new props, so state carries over.
const renderHosted = (initial: { chromeProps?: Partial<ScrollViewChromeProviderProps>; screenProps?: ScreenProps } = {}) => {
  const root = newSnapshot()
  const screen = newSnapshot()
  let current = initial
  const tree = (props: typeof initial) => (
    <ScrollViewChromeProvider footprint={FOOTPRINT} {...props.chromeProps}>
      <Probe into={root} />
      <ScrollViewProvider {...props.screenProps}>
        <Probe into={screen} />
      </ScrollViewProvider>
    </ScrollViewChromeProvider>
  )
  const view = render(tree(current))
  const update = (next: typeof initial) => {
    current = { chromeProps: { ...current.chromeProps, ...next.chromeProps }, screenProps: { ...current.screenProps, ...next.screenProps } }
    view.rerender(tree(current))
  }
  return { root, screen, update, unmount: view.unmount }
}

const renderUnhosted = (screenProps: ScreenProps = {}) => {
  const screen = newSnapshot()
  const view = render(
    <ScrollViewProvider {...screenProps}>
      <Probe into={screen} />
    </ScrollViewProvider>
  )
  return { screen, unmount: view.unmount }
}

describe('ScrollViewProvider hosted by a ScrollViewChromeProvider', () => {
  it('shares the host offset: its footerOffset IS the host SharedValue', () => {
    const { root, screen } = renderHosted()
    expect(screen.ctx?.footerOffset).toBe(root.chrome?.offset)
  })

  it('reports chromeHosted and takes the host footprint and overhang', () => {
    const { screen } = renderHosted({ chromeProps: { overhang: OVERHANG } })
    expect(screen.ctx?.chromeHosted).toBe(true)
    expect(screen.ctx?.chromeOverhang).toBe(OVERHANG)
  })

  it('replaces the consumer tabBarHeight guess with the exact footprint', () => {
    const { screen } = renderHosted({ screenProps: { tabBarHeight: 99 } })
    expect(screen.ctx?.tabBarHeight).toBe(FOOTPRINT)
  })

  it('follows a change of the host footprint', () => {
    const { screen, update } = renderHosted()
    update({ chromeProps: { footprint: 70 } })
    expect(screen.ctx?.tabBarHeight).toBe(70)
  })

  it('keeps chromeWritable false until this screen owns the host, then true', () => {
    const blurred = renderHosted({ chromeProps: { useIsActive: () => false } })
    expect(blurred.screen.ctx?.chromeWritable.value).toBe(false)
    const focused = renderHosted()
    expect(focused.screen.ctx?.chromeWritable.value).toBe(true)
  })

  it('hands the ChromeRegistrar its footerFixed so Footer Lock can reveal', () => {
    const { root, update } = renderHosted()
    root.chrome!.offset.value = 30
    update({ screenProps: { footerFixed: true } })
    expect(root.chrome?.offset.value).toBe(0)
  })

  describe('stackHeightShared', () => {
    it('is its own SharedValue, distinct from footerHeightShared', () => {
      const { screen } = renderHosted()
      expect(screen.ctx?.stackHeightShared).not.toBe(screen.ctx?.footerHeightShared)
    })

    it('is footprint + overhang + slack before any footer has measured', () => {
      const { screen } = renderHosted({ chromeProps: { overhang: OVERHANG } })
      expect(screen.ctx?.stackHeightShared.value).toBe(FOOTPRINT + OVERHANG + SLACK)
    })

    it('is footprint + footerHeight + slack once a footer taller than the overhang measures', () => {
      const { screen } = renderHosted({ chromeProps: { overhang: OVERHANG } })
      act(() => screen.ctx?.setFooterHeight(80))
      expect(screen.ctx?.footerHeight).toBe(80)
      expect(screen.ctx?.stackHeightShared.value).toBe(FOOTPRINT + 80 + SLACK)
      // The raw footer measurement is untouched by the chrome geometry.
      expect(screen.ctx?.footerHeightShared.value).toBe(80)
    })

    it('uses the overhang instead when the measured footer is shorter than it', () => {
      const { screen } = renderHosted({ chromeProps: { overhang: OVERHANG } })
      act(() => screen.ctx?.setFooterHeight(4))
      expect(screen.ctx?.stackHeightShared.value).toBe(FOOTPRINT + OVERHANG + SLACK)
    })

    it('falls back to the overhang when the footer unmounts (null height)', () => {
      const { screen } = renderHosted({ chromeProps: { overhang: OVERHANG } })
      act(() => screen.ctx?.setFooterHeight(80))
      act(() => screen.ctx?.setFooterHeight(null))
      expect(screen.ctx?.footerHeight).toBeNull()
      expect(screen.ctx?.stackHeightShared.value).toBe(FOOTPRINT + OVERHANG + SLACK)
    })

    it('has no overhang term (just footprint + slack) when the host has none and no footer measured', () => {
      const { screen } = renderHosted()
      expect(screen.ctx?.stackHeightShared.value).toBe(FOOTPRINT + SLACK)
    })

    it('recomputes when the host footprint or overhang change', () => {
      const { screen, update } = renderHosted({ chromeProps: { overhang: OVERHANG } })
      act(() => screen.ctx?.setFooterHeight(80))
      update({ chromeProps: { footprint: 70 } })
      expect(screen.ctx?.stackHeightShared.value).toBe(70 + 80 + SLACK)
      update({ chromeProps: { overhang: 100 } })
      expect(screen.ctx?.stackHeightShared.value).toBe(70 + 100 + SLACK)
    })
  })

  describe('snap-back', () => {
    it('forces the footer snap-back on when the host snaps back, even if the provider opts out', () => {
      const { screen } = renderHosted({ chromeProps: { snapBack: true }, screenProps: { snapBackFooter: false } })
      expect(screen.ctx?.snapBackFooterShared.value).toBe(true)
    })

    it('forces the footer snap-back off when the host does not, even if the provider opts in', () => {
      const { screen } = renderHosted({ chromeProps: { snapBack: false }, screenProps: { snapBackFooter: true } })
      expect(screen.ctx?.snapBackFooterShared.value).toBe(false)
    })

    it('snaps back by default, since the host defaults to snapBack', () => {
      const { screen } = renderHosted()
      expect(screen.ctx?.snapBackFooterShared.value).toBe(true)
    })

    it('leaves the header snap-back to its own setting, whatever the host says', () => {
      const on = renderHosted({ chromeProps: { snapBack: false }, screenProps: { snapBackHeader: true } })
      expect(on.screen.ctx?.snapBackHeaderShared.value).toBe(true)
      const off = renderHosted({ chromeProps: { snapBack: true }, screenProps: { snapBackHeader: false } })
      expect(off.screen.ctx?.snapBackHeaderShared.value).toBe(false)
    })

    it('still lets the general snapBack prop drive the header while the footer stays forced', () => {
      const { screen } = renderHosted({ chromeProps: { snapBack: false }, screenProps: { snapBack: true } })
      expect(screen.ctx?.snapBackHeaderShared.value).toBe(true)
      expect(screen.ctx?.snapBackFooterShared.value).toBe(false)
    })

    it('re-forces the footer snap-back when the host changes it', () => {
      const { screen, update } = renderHosted({ chromeProps: { snapBack: false } })
      expect(screen.ctx?.snapBackFooterShared.value).toBe(false)
      update({ chromeProps: { snapBack: true } })
      expect(screen.ctx?.snapBackFooterShared.value).toBe(true)
    })
  })

  describe('chrome={false}', () => {
    it('opts out of the host entirely', () => {
      const { root, screen } = renderHosted({ chromeProps: { overhang: OVERHANG }, screenProps: { chrome: false, tabBarHeight: 40 } })
      expect(screen.ctx?.chromeHosted).toBe(false)
      expect(screen.ctx?.chromeOverhang).toBe(0)
      expect(screen.ctx?.tabBarHeight).toBe(40)
      expect(screen.ctx?.footerOffset).not.toBe(root.chrome?.offset)
      expect(screen.ctx?.chromeWritable.value).toBe(true)
    })

    it('measures the unhosted way: stackHeightShared IS footerHeightShared', () => {
      const { screen } = renderHosted({ chromeProps: { overhang: OVERHANG }, screenProps: { chrome: false } })
      expect(screen.ctx?.stackHeightShared).toBe(screen.ctx?.footerHeightShared)
      act(() => screen.ctx?.setFooterHeight(80))
      expect(screen.ctx?.stackHeightShared.value).toBe(80)
    })

    it('never claims the host, so it cannot take ownership from a hosted screen', () => {
      const { root } = renderHosted({ screenProps: { chrome: false } })
      expect(root.host?.activeId).toBeNull()
    })

    it('follows its own snap-back settings rather than the host', () => {
      const { screen } = renderHosted({ chromeProps: { snapBack: true }, screenProps: { chrome: false, snapBackFooter: false } })
      expect(screen.ctx?.snapBackFooterShared.value).toBe(false)
    })
  })

  describe('a nested ScrollViewProvider', () => {
    it('is not hosted: the outer provider clears the claim machinery for its children', () => {
      const root = newSnapshot()
      const outer = newSnapshot()
      const inner = newSnapshot()
      render(
        <ScrollViewChromeProvider footprint={FOOTPRINT} overhang={OVERHANG}>
          <Probe into={root} />
          <ScrollViewProvider>
            <Probe into={outer} />
            <ScrollViewProvider tabBarHeight={12}>
              <Probe into={inner} />
            </ScrollViewProvider>
          </ScrollViewProvider>
        </ScrollViewChromeProvider>
      )
      expect(outer.ctx?.chromeHosted).toBe(true)
      expect(inner.ctx?.chromeHosted).toBe(false)
      expect(inner.ctx?.chromeOverhang).toBe(0)
      expect(inner.ctx?.tabBarHeight).toBe(12)
      expect(inner.ctx?.footerOffset).not.toBe(root.chrome?.offset)
      expect(inner.ctx?.stackHeightShared).toBe(inner.ctx?.footerHeightShared)
      expect(inner.ctx?.chromeWritable.value).toBe(true)
    })

    it('does not compete with the outer screen for the host', () => {
      const outer = newSnapshot()
      const inner = newSnapshot()
      render(
        <ScrollViewChromeProvider footprint={FOOTPRINT}>
          <ScrollViewProvider>
            <Probe into={outer} />
            <ScrollViewProvider>
              <Probe into={inner} />
            </ScrollViewProvider>
          </ScrollViewProvider>
        </ScrollViewChromeProvider>
      )
      expect(outer.ctx?.chromeWritable.value).toBe(true)
    })

    it('still sees the public chrome context (a bar below a provider keeps its pin/reveal controls)', () => {
      const root = newSnapshot()
      const inner = newSnapshot()
      render(
        <ScrollViewChromeProvider footprint={FOOTPRINT}>
          <Probe into={root} />
          <ScrollViewProvider>
            <ScrollViewProvider>
              <Probe into={inner} />
            </ScrollViewProvider>
          </ScrollViewProvider>
        </ScrollViewChromeProvider>
      )
      expect(inner.host).toBeNull()
      expect(inner.chrome).toBe(root.chrome)
    })
  })
})

// The host must be purely additive: a provider with no ScrollViewChromeProvider above it behaves
// exactly as it did before the host existed.
describe('ScrollViewProvider without a ScrollViewChromeProvider', () => {
  it('is not hosted and has no chrome geometry', () => {
    const { screen } = renderUnhosted()
    expect(screen.ctx?.chromeHosted).toBe(false)
    expect(screen.ctx?.chromeOverhang).toBe(0)
    expect(screen.ctx?.chromeWritable.value).toBe(true)
    expect(screen.host).toBeNull()
    expect(screen.chrome).toBeNull()
  })

  it('keeps the consumer tabBarHeight, defaulting to 0', () => {
    expect(renderUnhosted().screen.ctx?.tabBarHeight).toBe(0)
    expect(renderUnhosted({ tabBarHeight: 60 }).screen.ctx?.tabBarHeight).toBe(60)
  })

  it('owns a private footerOffset, separate per provider', () => {
    const a = renderUnhosted()
    const b = renderUnhosted()
    expect(a.screen.ctx?.footerOffset).not.toBe(b.screen.ctx?.footerOffset)
  })

  it('hides by exactly the footer height: stackHeightShared IS footerHeightShared', () => {
    const { screen } = renderUnhosted()
    expect(screen.ctx?.stackHeightShared).toBe(screen.ctx?.footerHeightShared)
    act(() => screen.ctx?.setFooterHeight(80))
    expect(screen.ctx?.stackHeightShared.value).toBe(80)
    act(() => screen.ctx?.setFooterHeight(null))
    expect(screen.ctx?.stackHeightShared.value).toBe(0)
  })

  it('follows its own snap-back settings for both bars', () => {
    expect(renderUnhosted().screen.ctx?.snapBackFooterShared.value).toBe(false)
    expect(renderUnhosted().screen.ctx?.snapBackHeaderShared.value).toBe(false)
    const footer = renderUnhosted({ snapBackFooter: true })
    expect(footer.screen.ctx?.snapBackFooterShared.value).toBe(true)
    expect(footer.screen.ctx?.snapBackHeaderShared.value).toBe(false)
    const header = renderUnhosted({ snapBackHeader: true })
    expect(header.screen.ctx?.snapBackHeaderShared.value).toBe(true)
    expect(header.screen.ctx?.snapBackFooterShared.value).toBe(false)
    const both = renderUnhosted({ snapBack: true })
    expect(both.screen.ctx?.snapBackHeaderShared.value).toBe(true)
    expect(both.screen.ctx?.snapBackFooterShared.value).toBe(true)
  })

  it('exposes the same defaults through the bare ScrollViewContext', () => {
    let captured: ScrollViewContextType | undefined
    const Reader = () => {
      captured = useContext(ScrollViewContext)
      return null
    }
    render(<Reader />)
    expect(captured?.chromeHosted).toBe(false)
    expect(captured?.chromeOverhang).toBe(0)
    expect(captured?.tabBarHeight).toBe(0)
  })
})

describe('ScrollViewProvider chrome host cleanup', () => {
  // Only the registrar ever writes chromeWritable while hosted. A provider that stops being hosted
  // while it stays mounted loses its registrar with it, so without this reset it would keep whatever
  // the registrar last wrote — false for a non-owner — and its own snap-back footer would stay off.
  it('resets chromeWritable to true when a non-owning hosted provider stops being hosted', () => {
    const { screen, update } = renderHosted({ chromeProps: { useIsActive: () => false } })
    expect(screen.ctx?.chromeWritable.value).toBe(false)
    update({ screenProps: { chrome: false } })
    expect(screen.ctx?.chromeHosted).toBe(false)
    expect(screen.ctx?.chromeWritable.value).toBe(true)
  })

  describe('when the list unmounts', () => {
    // The owning screen's list is the last scroll source for the shared offset; a screen that swaps
    // it for non-scrolling content would otherwise keep the bar hidden with nothing to bring it back.
    it('reveals the stack when this provider owns the host', () => {
      const { root, screen } = renderHosted()
      root.chrome!.offset.value = 40
      act(() => screen.ctx?.onListUnmount())
      expect(root.chrome!.offset.value).toBe(0)
    })

    it('leaves the stack alone when another screen owns the host', () => {
      const { root, screen } = renderHosted({ chromeProps: { useIsActive: () => false } })
      root.chrome!.offset.value = 40
      act(() => screen.ctx?.onListUnmount())
      expect(root.chrome!.offset.value).toBe(40)
    })

    it('leaves the stack alone when the provider opted out with chrome={false}', () => {
      const { root, screen } = renderHosted({ screenProps: { chrome: false } })
      root.chrome!.offset.value = 40
      act(() => screen.ctx?.onListUnmount())
      expect(root.chrome!.offset.value).toBe(40)
    })

    it('still bumps the list generation, hosted or not', () => {
      const hosted = renderHosted()
      const before = hosted.screen.ctx!.listGeneration.value
      act(() => hosted.screen.ctx?.onListUnmount())
      expect(hosted.screen.ctx!.listGeneration.value).toBe(before + 1)

      const unhosted = renderUnhosted()
      const unhostedBefore = unhosted.screen.ctx!.listGeneration.value
      act(() => unhosted.screen.ctx?.onListUnmount())
      expect(unhosted.screen.ctx!.listGeneration.value).toBe(unhostedBefore + 1)
    })
  })
})
