import { createSettingsContext, type SettingsContextValue } from '@rific/core'

export type ScrollViewSettings = {
  backActionFixed: boolean
  footerFixed: boolean
  headerFixed: boolean
  snapBack: boolean
  snapBackFooter?: boolean
  snapBackHeader?: boolean
}

export const defaultScrollViewSettings: ScrollViewSettings = {
  backActionFixed: true,
  footerFixed: false,
  headerFixed: false,
  snapBack: false
}

export type ScrollViewSettingsContextType = SettingsContextValue<ScrollViewSettings>

// Single createSettingsContext() call, shared by ScrollViewSettingsProvider.tsx and
// useScrollViewSettings.ts (each just re-exports the relevant piece under its original name) so
// there's exactly one Context instance backing all three files, same as before this migration.
const settingsContext = createSettingsContext<ScrollViewSettings>(defaultScrollViewSettings)

export const ScrollViewSettingsContext = settingsContext.Context
export const scrollViewSettingsProvider = settingsContext.Provider
export const scrollViewUseSettings = settingsContext.useSettings
