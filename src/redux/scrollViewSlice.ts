import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { defaultScrollViewSettings, type ScrollViewSettings } from '../ScrollViewSettingsContext'

const slice = createSlice({
  name: 'scrollView',
  initialState: defaultScrollViewSettings,
  reducers: {
    initialize: (_state, action: PayloadAction<ScrollViewSettings>) => action.payload
  }
})

export const scrollViewActions = slice.actions
export const scrollViewReducer = slice.reducer
