import { render } from '@testing-library/react'
import React from 'react'

import { PullSearch, type PullSearchHandle } from '../PullSearch'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

describe('PullSearch', () => {
  it('renders without crashing', () => {
    render(<PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper })
  })

  it('renders with placeholder', () => {
    render(
      <PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} placeholder='Search items...' />,
      { wrapper }
    )
  })

  it('renders with initial value', () => {
    render(<PullSearch onChangeText={jest.fn()} onHeightChange={jest.fn()} value='hello' />, { wrapper })
  })

  it('exposes blur and focus via imperative ref', () => {
    const ref = React.createRef<PullSearchHandle>()
    render(<PullSearch ref={ref} onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper })
    expect(typeof ref.current?.blur).toBe('function')
    expect(typeof ref.current?.focus).toBe('function')
  })

  it('does not throw when blur/focus called with no input mounted', () => {
    const ref = React.createRef<PullSearchHandle>()
    render(<PullSearch ref={ref} onChangeText={jest.fn()} onHeightChange={jest.fn()} />, { wrapper })
    expect(() => ref.current?.blur()).not.toThrow()
    expect(() => ref.current?.focus()).not.toThrow()
  })
})
