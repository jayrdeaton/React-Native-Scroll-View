import { createSettingsSlice } from '@rific/core'

import { defaultScrollViewSettings, type ScrollViewSettings } from '../ScrollViewSettingsContext'

// scrollView has no per-field setters, just a full-replace initialize — matches the previous
// hand-rolled slice exactly (action type 'scrollView/initialize', full-state-replace behavior).
const scrollViewSlice = createSettingsSlice<ScrollViewSettings>('scrollView', {
  initialState: defaultScrollViewSettings,
  fieldSetters: []
})

export const scrollViewActions = scrollViewSlice.actions
export const scrollViewReducer = scrollViewSlice.reducer
