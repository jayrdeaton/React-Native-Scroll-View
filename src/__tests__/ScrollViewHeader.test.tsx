import { render } from '@testing-library/react'
import React from 'react'

import { ScrollViewFooter } from '../ScrollViewFooter'
import { ScrollViewHeader } from '../ScrollViewHeader'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

describe('ScrollViewHeader', () => {
  it('renders without crashing', () => {
    render(<ScrollViewHeader />, { wrapper })
  })

  it('renders with children', () => {
    render(<ScrollViewHeader><></></ScrollViewHeader>, { wrapper })
  })
})

describe('ScrollViewFooter', () => {
  it('renders without crashing', () => {
    render(<ScrollViewFooter />, { wrapper })
  })

  it('renders with children', () => {
    render(<ScrollViewFooter><></></ScrollViewFooter>, { wrapper })
  })
})
