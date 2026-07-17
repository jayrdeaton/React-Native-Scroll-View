import { defaultScrollViewSettings, type ScrollViewSettings } from '../ScrollViewSettingsContext'

// Hand-rolled slice — no @reduxjs/toolkit dependency. Action types and creator
// behavior match the previous createSlice implementation exactly, so this works
// with RTK stores, vanilla Redux, or any reducer-based state container.
type PayloadAction<P> = { payload: P; type: string }

const createAction = <P>(type: string) => {
  const actionCreator = (payload: P): PayloadAction<P> => ({ payload, type })
  actionCreator.type = type
  actionCreator.match = (action: { type: string }): action is PayloadAction<P> => action.type === type
  return actionCreator
}

const initialize = createAction<ScrollViewSettings>('scrollView/initialize')

export const scrollViewActions = { initialize }

export const scrollViewReducer = (state: ScrollViewSettings = defaultScrollViewSettings, action: { type: string }): ScrollViewSettings => {
  if (initialize.match(action)) return action.payload
  return state
}
