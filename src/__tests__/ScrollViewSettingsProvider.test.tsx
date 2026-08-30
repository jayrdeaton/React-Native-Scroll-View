import { act, render } from '@testing-library/react'

import { defaultScrollViewSettings } from '../ScrollViewSettingsContext'
import { ScrollViewSettingsProvider } from '../ScrollViewSettingsProvider'
import { useScrollViewSettings } from '../useScrollViewSettings'

const ContextReader = ({ onRead }: { onRead: (v: ReturnType<typeof useScrollViewSettings>) => void }) => {
  const value = useScrollViewSettings()
  onRead(value)
  return null
}

describe('ScrollViewSettingsProvider', () => {
  it('renders without crashing', () => {
    render(
      <ScrollViewSettingsProvider>
        <></>
      </ScrollViewSettingsProvider>
    )
  })

  it('provides default settings when no initialValue is given', () => {
    let capturedValue: ReturnType<typeof useScrollViewSettings> | undefined
    render(
      <ScrollViewSettingsProvider>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewSettingsProvider>
    )
    expect(capturedValue?.settings).toEqual(defaultScrollViewSettings)
  })

  it('merges initialValue over the defaults', () => {
    let capturedValue: ReturnType<typeof useScrollViewSettings> | undefined
    render(
      <ScrollViewSettingsProvider initialValue={{ headerFixed: true }}>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewSettingsProvider>
    )
    expect(capturedValue?.settings).toEqual({ ...defaultScrollViewSettings, headerFixed: true })
  })

  it('merges a set(patch) call into existing settings using the previous state', () => {
    let capturedValue: ReturnType<typeof useScrollViewSettings> | undefined
    render(
      <ScrollViewSettingsProvider initialValue={{ headerFixed: true }}>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewSettingsProvider>
    )
    act(() => {
      capturedValue?.set({ footerFixed: true })
    })
    expect(capturedValue?.settings).toEqual({ ...defaultScrollViewSettings, headerFixed: true, footerFixed: true })
  })

  it('calls onChange with the new merged settings when set() is called, but not on initial mount', () => {
    const onChange = jest.fn()
    let capturedValue: ReturnType<typeof useScrollViewSettings> | undefined
    render(
      <ScrollViewSettingsProvider onChange={onChange}>
        <ContextReader
          onRead={(v) => {
            capturedValue = v
          }}
        />
      </ScrollViewSettingsProvider>
    )
    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      capturedValue?.set({ snapBack: true })
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ ...defaultScrollViewSettings, snapBack: true })
  })
})
