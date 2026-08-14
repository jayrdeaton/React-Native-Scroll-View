import { render } from '@testing-library/react'
import React from 'react'
import { Chip } from '@rific/auto-paper'
import { Icon } from 'react-native-paper'

import { ScrollViewChip } from '../internal/ScrollViewChip'

const mockChip = jest.mocked(Chip)
const mockIcon = jest.mocked(Icon)

describe('ScrollViewChip', () => {
  beforeEach(() => {
    mockChip.mockClear()
    mockIcon.mockClear()
  })

  it('renders the chevron as a custom avatar Icon, not Chip\'s own `icon` prop', () => {
    render(<ScrollViewChip onPress={() => {}} style={{}} />)
    const props = mockChip.mock.calls[0][0]
    expect(props.icon).toBeUndefined()
    expect(React.isValidElement(props.avatar)).toBe(true)
  })

  it('defaults the avatar icon color to onSecondaryContainer (matching Chip\'s own default label color) when no selectedColor is given', () => {
    render(<ScrollViewChip onPress={() => {}} style={{}} />)
    const avatar = mockChip.mock.calls[0][0].avatar as React.ReactElement<{ color?: string }>
    expect(avatar.props.color).toBe('#1d192b')
  })

  it('falls back to onSurfaceVariant when mode is outlined, matching Chip\'s own outlined text color', () => {
    render(<ScrollViewChip onPress={() => {}} style={{}} chipProps={{ mode: 'outlined' }} />)
    const avatar = mockChip.mock.calls[0][0].avatar as React.ReactElement<{ color?: string }>
    expect(avatar.props.color).toBe('#49454f')
  })

  it('uses selectedColor for the avatar icon when provided, so it stays visible against a caller-chosen background', () => {
    render(<ScrollViewChip onPress={() => {}} style={{}} chipProps={{ selectedColor: '#fee8e7' }} />)
    const avatar = mockChip.mock.calls[0][0].avatar as React.ReactElement<{ color?: string }>
    expect(avatar.props.color).toBe('#fee8e7')
    // selectedColor is still forwarded to Chip itself too, for its own (working) text/border/ripple derivation.
    expect(mockChip.mock.calls[0][0].selectedColor).toBe('#fee8e7')
  })

  it('renders chevron-up by default and chevron-left when isHorizontal', () => {
    render(<ScrollViewChip onPress={() => {}} style={{}} />)
    let avatar = mockChip.mock.calls[0][0].avatar as React.ReactElement<{ source?: string }>
    expect(avatar.props.source).toBe('chevron-up')

    mockChip.mockClear()
    render(<ScrollViewChip onPress={() => {}} style={{}} isHorizontal />)
    avatar = mockChip.mock.calls[0][0].avatar as React.ReactElement<{ source?: string }>
    expect(avatar.props.source).toBe('chevron-left')
  })

  it('defaults the label to Top/Start, overridable via chipProps.label', () => {
    const { getByText, rerender } = render(<ScrollViewChip onPress={() => {}} style={{}} />)
    expect(getByText('Top')).toBeTruthy()

    rerender(<ScrollViewChip onPress={() => {}} style={{}} isHorizontal />)
    expect(getByText('Start')).toBeTruthy()

    rerender(<ScrollViewChip onPress={() => {}} style={{}} chipProps={{ label: 'Back to top' }} />)
    expect(getByText('Back to top')).toBeTruthy()
  })
})
