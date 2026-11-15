import { render } from '@testing-library/react'
import { RefreshControl as RNRefreshControl } from 'react-native'

import { RefreshControl } from '../index'

const lastProps = () => (RNRefreshControl as unknown as jest.Mock).mock.lastCall?.[0] as Record<string, unknown>

beforeEach(() => (RNRefreshControl as unknown as jest.Mock).mockClear())

describe('RefreshControl', () => {
  it("draws in the theme's colors: the primary arrow and spinner, and Android's disk on the level-3 elevation", () => {
    render(<RefreshControl onRefresh={() => {}} />)
    expect(lastProps()).toMatchObject({ colors: ['#6200ee'], tintColor: '#6200ee', progressBackgroundColor: '#f3edf7' })
  })

  it('defaults refreshing to false and turns the pull on with an onRefresh', () => {
    render(<RefreshControl onRefresh={() => {}} />)
    expect(lastProps()).toMatchObject({ refreshing: false, enabled: true })
  })

  it("turns Android's pull off without an onRefresh, so there's no disk to pull down for nothing", () => {
    render(<RefreshControl />)
    expect(lastProps()).toMatchObject({ enabled: false })
  })

  it('lets props passed in win over the theme and the defaults', () => {
    render(<RefreshControl onRefresh={() => {}} refreshing colors={['#ff0000']} tintColor='#00ff00' progressBackgroundColor='#0000ff' enabled={false} />)
    expect(lastProps()).toMatchObject({ refreshing: true, colors: ['#ff0000'], tintColor: '#00ff00', progressBackgroundColor: '#0000ff', enabled: false })
  })
})
