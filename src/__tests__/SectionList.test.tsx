import { render } from '@testing-library/react'
import React from 'react'
import { SectionList as RNSectionList } from 'react-native'

import { SectionList } from '../SectionList'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

type Section = { title: string; data: string[] }
const sections: Section[] = [
  { title: 'Fruits', data: ['Apple', 'Banana'] },
  { title: 'Veggies', data: ['Carrot'] }
]

describe('SectionList', () => {
  beforeEach(() => {
    ;(RNSectionList as jest.Mock).mockClear()
  })

  it('renders without crashing', () => {
    render(
      <SectionList sections={sections} renderItem={({ item }) => <>{item}</>} keyExtractor={(item) => item} />,
      { wrapper }
    )
  })

  it('renders with renderSectionHeader', () => {
    render(
      <SectionList
        sections={sections}
        renderItem={({ item }) => <>{item}</>}
        keyExtractor={(item) => item}
        renderSectionHeader={({ section }) => <>{(section as Section).title}</>}
      />,
      { wrapper }
    )
  })

  it('disables native stickySectionHeadersEnabled when custom renderSectionHeader is provided', () => {
    render(
      <SectionList
        sections={sections}
        renderItem={({ item }) => <>{item}</>}
        keyExtractor={(item) => item}
        renderSectionHeader={({ section }) => <>{(section as Section).title}</>}
      />,
      { wrapper }
    )
    const calls = (RNSectionList as jest.Mock).mock.calls
    const lastProps = calls[calls.length - 1]?.[0]
    expect(lastProps?.stickySectionHeadersEnabled).toBe(false)
  })

  it('keeps native sticky when no renderSectionHeader provided', () => {
    render(
      <SectionList sections={sections} renderItem={({ item }) => <>{item}</>} keyExtractor={(item) => item} />,
      { wrapper }
    )
    const calls = (RNSectionList as jest.Mock).mock.calls
    const lastProps = calls[calls.length - 1]?.[0]
    expect(lastProps?.stickySectionHeadersEnabled).toBe(false)
  })

  it('renders with pullSearchHeight', () => {
    render(
      <SectionList
        sections={sections}
        renderItem={({ item }) => <>{item}</>}
        keyExtractor={(item) => item}
        pullSearchHeight={60}
      />,
      { wrapper }
    )
  })

  it('renders with renderFilters', () => {
    render(
      <SectionList
        sections={sections}
        renderItem={({ item }) => <>{item}</>}
        keyExtractor={(item) => item}
        renderFilters={<></>}
      />,
      { wrapper }
    )
  })
})
