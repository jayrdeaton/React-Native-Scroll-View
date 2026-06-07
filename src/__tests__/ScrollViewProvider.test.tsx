import { render } from '@testing-library/react'
import React, { useContext } from 'react'

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
        <ContextReader onRead={(v) => { capturedValue = v }} />
      </ScrollViewProvider>
    )
    expect(capturedValue?.progress).toBeNull()
    expect(capturedValue?.progressing).toBe(false)
  })

  it('accepts headerLock and footerLock props', () => {
    let capturedCtx: { headerLock: boolean; footerLock: boolean } | undefined
    const Reader = () => {
      const ctx = useContext(ScrollViewContext)
      capturedCtx = { headerLock: ctx.headerLock, footerLock: ctx.footerLock }
      return null
    }
    render(
      <ScrollViewProvider headerLock footerLock>
        <Reader />
      </ScrollViewProvider>
    )
    expect(capturedCtx?.headerLock).toBe(true)
    expect(capturedCtx?.footerLock).toBe(true)
  })

  it('setProgress updates progress value', () => {
    let capturedValue: ReturnType<typeof useScrollView> | undefined
    const { rerender } = render(
      <ScrollViewProvider>
        <ContextReader onRead={(v) => { capturedValue = v }} />
      </ScrollViewProvider>
    )
    capturedValue?.setProgress(0.5)
    rerender(
      <ScrollViewProvider>
        <ContextReader onRead={(v) => { capturedValue = v }} />
      </ScrollViewProvider>
    )
    expect(capturedValue?.progress).toBe(0.5)
  })
})
