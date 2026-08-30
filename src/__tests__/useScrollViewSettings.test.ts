import { act, render } from '@testing-library/react'
import { createElement } from 'react'

import { defaultScrollViewSettings } from '../ScrollViewSettingsContext'
import { ScrollViewSettingsProvider } from '../ScrollViewSettingsProvider'
import { useScrollViewSettings } from '../useScrollViewSettings'

const ContextReader = ({ onRead }: { onRead: (v: ReturnType<typeof useScrollViewSettings>) => void }) => {
  const value = useScrollViewSettings()
  onRead(value)
  return null
}

describe('useScrollViewSettings', () => {
  it('returns the live settings/set from an enclosing ScrollViewSettingsProvider', () => {
    let capturedValue: ReturnType<typeof useScrollViewSettings> | undefined
    render(
      createElement(
        ScrollViewSettingsProvider,
        null,
        createElement(ContextReader, {
          onRead: (v) => {
            capturedValue = v
          }
        })
      )
    )
    expect(capturedValue?.settings).toEqual(defaultScrollViewSettings)
    act(() => {
      capturedValue?.set({ backActionFixed: false })
    })
    expect(capturedValue?.settings).toEqual({ ...defaultScrollViewSettings, backActionFixed: false })
  })

  it('returns the default context value when used without a provider', () => {
    let capturedValue: ReturnType<typeof useScrollViewSettings> | undefined
    render(
      createElement(ContextReader, {
        onRead: (v) => {
          capturedValue = v
        }
      })
    )
    expect(capturedValue?.settings).toEqual(defaultScrollViewSettings)
    expect(typeof capturedValue?.set).toBe('function')
    expect(() => capturedValue?.set({ headerFixed: true })).not.toThrow()
  })
})
