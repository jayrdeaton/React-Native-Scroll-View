import type { SettingsProviderProps } from '@rific/core'

import { type ScrollViewSettings, scrollViewSettingsProvider } from './ScrollViewSettingsContext'

export type ScrollViewSettingsProviderProps = SettingsProviderProps<ScrollViewSettings>

export const ScrollViewSettingsProvider = scrollViewSettingsProvider
