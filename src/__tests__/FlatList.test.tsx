import { render } from '@testing-library/react'
import React from 'react'

import { FlatList } from '../FlatList'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

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
