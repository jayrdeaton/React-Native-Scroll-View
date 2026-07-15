import { render } from '@testing-library/react'
import React from 'react'
import { FlatList as RNFlatList } from 'react-native'

import { FlatList } from '../FlatList'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

type MockFlatListProps = {
  data?: unknown
  keyExtractor?: (item: never, index: number) => string
  numColumns?: number
  renderItem?: (info: unknown) => React.ReactNode
  [key: string]: unknown
}

const lastCallProps = () => {
  const calls = (RNFlatList as unknown as jest.Mock).mock.calls
  return calls[calls.length - 1]?.[0] as MockFlatListProps | undefined
}

describe('FlatList', () => {
  it('renders without crashing', () => {
    render(<FlatList data={[]} renderItem={() => null} />, { wrapper })
  })

  it('renders with data items', () => {
    render(
      <FlatList data={['a', 'b', 'c']} renderItem={({ item }) => <>{item}</>} keyExtractor={(item) => item} />,
      { wrapper }
    )
  })

  it('renders horizontal', () => {
    render(<FlatList data={[]} renderItem={() => null} horizontal />, { wrapper })
  })

  it('renders horizontal paged list with HorizontalDots for multiple items', () => {
    render(
      <FlatList
        data={['a', 'b', 'c']}
        renderItem={({ item }) => <>{item}</>}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
      />,
      { wrapper }
    )
  })

  it('renders with pullSearchHeight', () => {
    render(<FlatList data={[]} renderItem={() => null} pullSearchHeight={60} />, { wrapper })
  })

  it('renders with renderFilters', () => {
    render(
      <FlatList data={[]} renderItem={() => null} renderFilters={<></>} />,
      { wrapper }
    )
  })

  it('renders with keyboardAware', () => {
    render(<FlatList data={[]} renderItem={() => null} keyboardAware />, { wrapper })
  })
})

describe('FlatList numColumns row-chunking', () => {
  beforeEach(() => (RNFlatList as unknown as jest.Mock).mockClear())

  it('passes data through unchanged when numColumns is omitted', () => {
    const data = ['a', 'b', 'c']
    render(<FlatList data={data} renderItem={() => null} keyExtractor={(item) => item} />, { wrapper })
    expect(lastCallProps()?.data).toBe(data)
  })

  it('passes data through unchanged when numColumns is 1', () => {
    const data = ['a', 'b', 'c']
    render(<FlatList data={data} renderItem={() => null} keyExtractor={(item) => item} numColumns={1} />, { wrapper })
    expect(lastCallProps()?.data).toBe(data)
  })

  it('never forwards the numColumns prop itself to the underlying RNFlatList', () => {
    render(<FlatList data={['a', 'b', 'c']} renderItem={() => null} keyExtractor={(item) => item} numColumns={3} />, { wrapper })
    expect(lastCallProps()?.numColumns).toBeUndefined()
  })

  it('chunks data into rows of numColumns, with a partial last row', () => {
    render(<FlatList data={['a', 'b', 'c', 'd', 'e']} renderItem={() => null} keyExtractor={(item) => item} numColumns={2} />, { wrapper })
    expect(lastCallProps()?.data).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  it('row keyExtractor joins per-item keys with a colon', () => {
    render(<FlatList data={['a', 'b', 'c', 'd']} renderItem={() => null} keyExtractor={(item) => item} numColumns={2} />, { wrapper })
    const rowKeyExtractor = lastCallProps()?.keyExtractor
    expect(rowKeyExtractor?.(['a', 'b'] as never, 0)).toBe('a:b')
    expect(rowKeyExtractor?.(['c', 'd'] as never, 1)).toBe('c:d')
  })

  it('row renderItem renders every item in the row via the original renderItem', () => {
    render(
      <FlatList
        data={['fig', 'kiwi', 'plum']}
        renderItem={({ item }) => <>{item}</>}
        keyExtractor={(item) => item}
        numColumns={2}
      />,
      { wrapper }
    )
    const rowRenderItem = lastCallProps()?.renderItem
    const { container } = render(rowRenderItem?.({ index: 0, item: ['fig', 'kiwi'], separators: {} as never }) as React.ReactElement)
    expect(container.textContent).toContain('fig')
    expect(container.textContent).toContain('kiwi')
    expect(container.textContent).not.toContain('plum')
  })

  it('renderItem indexes items by their position across the whole flattened list, not just within the row', () => {
    const indices: number[] = []
    render(
      <FlatList
        data={['a', 'b', 'c', 'd', 'e']}
        renderItem={({ index }) => {
          indices.push(index)
          return null
        }}
        keyExtractor={(item) => item}
        numColumns={2}
      />,
      { wrapper }
    )
    const rowRenderItem = lastCallProps()?.renderItem
    render(rowRenderItem?.({ index: 2, item: ['e'], separators: {} as never }) as React.ReactElement)
    expect(indices).toEqual([4]) // row index 2 * numColumns 2 + column 0
  })
})
