import { useContext } from 'react'

import { ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export const useScrollViewSettings = () => useContext(ScrollViewSettingsContext)
