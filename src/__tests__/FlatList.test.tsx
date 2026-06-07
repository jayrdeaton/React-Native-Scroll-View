import { render } from '@testing-library/react'
import React from 'react'

import { FlatList } from '../FlatList'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

describe('FlatList', () => {
  it('renders without crashing', () => {
    render(<FlatList data={[]} renderItem={() => null} />, { wrapper })
  })
})
