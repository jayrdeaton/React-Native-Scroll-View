import { render } from '@testing-library/react'
import React from 'react'

import { CustomList } from '../CustomList'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

type MockListProps = {
  contentInset?: unknown
  contentOffset?: unknown
  onScroll?: unknown
  scrollEventThrottle?: number
  onMomentumScrollEnd?: unknown
  onScrollBeginDrag?: unknown
  onScrollEndDrag?: unknown
  [key: string]: unknown
}

const MockList = jest.fn((_props: MockListProps) => null)

describe('CustomList', () => {
  beforeEach(() => MockList.mockClear())

  it('renders without crashing', () => {
    render(<CustomList component={MockList} />, { wrapper })
  })

  it('wires up contentInset and contentOffset', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(props).toHaveProperty('contentInset')
    expect(props).toHaveProperty('contentOffset')
  })

  it('passes scrollEventThrottle={16}', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(props?.scrollEventThrottle).toBe(16)
  })

  it('passes onScroll handler', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(typeof props?.onScroll).toBe('function')
  })

  it('passes momentum and drag scroll handlers', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(typeof props?.onMomentumScrollEnd).toBe('function')
    expect(typeof props?.onScrollBeginDrag).toBe('function')
    expect(typeof props?.onScrollEndDrag).toBe('function')
  })

  it('forwards extra props to the inner component', () => {
    render(<CustomList component={MockList} testID='my-list' />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(props?.testID).toBe('my-list')
  })
})
