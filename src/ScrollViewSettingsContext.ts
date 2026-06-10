import { createContext } from 'react'

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

export type ScrollViewSettingsContextType = {
  settings: ScrollViewSettings
  set: (patch: Partial<ScrollViewSettings>) => void
}

export const ScrollViewSettingsContext = createContext<ScrollViewSettingsContextType>({
  settings: defaultScrollViewSettings,
  set: () => {}
})
