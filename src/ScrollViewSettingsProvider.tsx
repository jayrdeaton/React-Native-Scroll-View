import { type ReactNode, useCallback, useMemo, useState } from 'react'

import { defaultScrollViewSettings, type ScrollViewSettings, ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export type ScrollViewSettingsProviderProps = {
  children: ReactNode
  onChange?: (settings: ScrollViewSettings) => void
  initialValue?: Partial<ScrollViewSettings>
}

export const ScrollViewSettingsProvider = ({ children, onChange, initialValue }: ScrollViewSettingsProviderProps) => {
  const [settings, setSettings] = useState<ScrollViewSettings>(() => ({
    ...defaultScrollViewSettings,
    ...initialValue
  }))

  const set = useCallback(
    (patch: Partial<ScrollViewSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        onChange?.(next)
        return next
      })
    },
    [onChange]
  )

  const ctx = useMemo(() => ({ settings, set }), [settings, set])

  return <ScrollViewSettingsContext.Provider value={ctx}>{children}</ScrollViewSettingsContext.Provider>
}
