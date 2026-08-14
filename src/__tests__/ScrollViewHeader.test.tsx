import { render } from '@testing-library/react'
import React from 'react'
import { Appbar } from 'react-native-paper'

import { ScrollViewFooter } from '../ScrollViewFooter'
import { ScrollViewHeader } from '../ScrollViewHeader'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

// The mocked Appbar.BackAction (see __mocks__/react-native-paper.ts) renders nothing at all, so
// the only way to observe which path ScrollViewHeader took is the mock's own call record — not
// anything queryable in the rendered tree.
const mockBackAction = jest.mocked(Appbar.BackAction)

describe('ScrollViewHeader', () => {
  beforeEach(() => {
    mockBackAction.mockClear()
  })

  it('renders without crashing', () => {
    render(<ScrollViewHeader />, { wrapper })
  })

  it('renders with children', () => {
    render(<ScrollViewHeader><></></ScrollViewHeader>, { wrapper })
  })

  it('renders the default Appbar.BackAction, passed through onPress/accessibilityLabel, when backAction is a plain callback', () => {
    const onPress = () => {}
    render(<ScrollViewHeader backAction={onPress} backActionAccessibilityLabel='Close' />, { wrapper })
    expect(mockBackAction).toHaveBeenCalledTimes(1)
    expect(mockBackAction.mock.calls[0][0]).toEqual(expect.objectContaining({ onPress, accessibilityLabel: 'Close' }))
  })

  it('renders a custom element in place of the default Appbar.BackAction when backAction is a ReactNode', () => {
    const { getByTestId } = render(<ScrollViewHeader backAction={<button data-testid='custom-back' />} />, { wrapper })
    expect(getByTestId('custom-back')).toBeTruthy()
    expect(mockBackAction).not.toHaveBeenCalled()
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
