import { render } from '@testing-library/react'
import React from 'react'

import { ScrollView } from '../ScrollView'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

describe('ScrollView', () => {
  it('renders without crashing', () => {
    render(<ScrollView />, { wrapper })
  })

  it('renders children', () => {
    const { getByText } = render(
      <ScrollView>
        <></>
      </ScrollView>,
      { wrapper }
    )
    expect(getByText).toBeDefined()
  })
})
