import { scrollViewActions, scrollViewReducer } from '../redux/scrollViewSlice'
import { defaultScrollViewSettings, type ScrollViewSettings } from '../ScrollViewSettingsContext'

const unrelatedAction = { type: 'unrelated/action' }

const otherSettings: ScrollViewSettings = {
  backActionFixed: false,
  footerFixed: true,
  headerFixed: true,
  snapBack: true,
  snapBackFooter: true,
  snapBackHeader: true
}

describe('scrollViewActions.initialize', () => {
  it('returns an action with the payload and the scrollView/initialize type', () => {
    expect(scrollViewActions.initialize(otherSettings)).toEqual({
      payload: otherSettings,
      type: 'scrollView/initialize'
    })
  })

  it('exposes its type on the action creator', () => {
    expect(scrollViewActions.initialize.type).toBe('scrollView/initialize')
  })

  it('matches an action with the scrollView/initialize type', () => {
    expect(scrollViewActions.initialize.match(scrollViewActions.initialize(otherSettings))).toBe(true)
  })

  it('does not match an action with a different type', () => {
    expect(scrollViewActions.initialize.match(unrelatedAction)).toBe(false)
  })
})

describe('scrollViewReducer', () => {
  it('defaults to defaultScrollViewSettings when state is undefined', () => {
    expect(scrollViewReducer(undefined, unrelatedAction)).toEqual(defaultScrollViewSettings)
  })

  it('returns the existing state unchanged for an unrelated action', () => {
    expect(scrollViewReducer(otherSettings, unrelatedAction)).toBe(otherSettings)
  })

  it('replaces the state with the payload on initialize', () => {
    const state: ScrollViewSettings = { ...defaultScrollViewSettings }
    expect(scrollViewReducer(state, scrollViewActions.initialize(otherSettings))).toBe(otherSettings)
  })
})
