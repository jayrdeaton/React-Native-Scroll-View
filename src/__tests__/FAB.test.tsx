import { FAB as AutoPaperFAB } from '@rific/auto-paper'
import { render } from '@testing-library/react'

import { FAB } from '../internal/FAB'

const mockFAB = jest.mocked(AutoPaperFAB)

describe('FAB', () => {
  beforeEach(() => {
    mockFAB.mockClear()
  })

  it('applies fixed defaults (animated: false, label: "", size: "small") and forwards icon/onPress/style unchanged', () => {
    const onPress = () => {}
    const style = { margin: 16 }
    render(<FAB icon='plus' onPress={onPress} style={style} />)

    const props = mockFAB.mock.calls[0][0]
    expect(props.animated).toBe(false)
    expect(props.label).toBe('')
    expect(props.size).toBe('small')
    expect(props.icon).toBe('plus')
    expect(props.onPress).toBe(onPress)
    expect(props.style).toBe(style)
  })

  it('still applies the fixed defaults with only a minimal prop set (icon only)', () => {
    render(<FAB icon='plus' />)

    const props = mockFAB.mock.calls[0][0]
    expect(props.animated).toBe(false)
    expect(props.label).toBe('')
    expect(props.size).toBe('small')
    expect(props.icon).toBe('plus')
  })
})
