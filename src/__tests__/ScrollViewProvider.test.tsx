import { act, render } from '@testing-library/react'
import { useContext } from 'react'
import { Platform } from 'react-native'

import { ScrollViewContext } from '../ScrollViewContext'
import { ScrollViewProvider } from '../ScrollViewProvider'
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
