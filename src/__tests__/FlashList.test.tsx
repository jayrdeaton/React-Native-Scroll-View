import { render } from '@testing-library/react'
import React from 'react'

import { FlashList } from '../FlashList'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

describe('FlashList', () => {
  it('renders without crashing', () => {
    render(<FlashList data={[]} renderItem={() => null} estimatedItemSize={50} />, { wrapper })
  })
})
