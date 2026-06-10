import { useBlur } from '@rific/auto-paper'
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Dimensions } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { ScrollViewContext } from './ScrollViewContext'
import { ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export type ScrollViewProviderProps = {
  blur?: boolean
  children: ReactNode
  fixed?: boolean
  footerFixed?: boolean
  headerFixed?: boolean
  snapBack?: boolean
  snapBackFooter?: boolean
  snapBackHeader?: boolean
  tabBarHeight?: number
}

export const ScrollViewProvider = ({ blur, children, fixed = false, footerFixed, headerFixed, snapBack, snapBackFooter, snapBackHeader, tabBarHeight = 60 }: ScrollViewProviderProps) => {
  const { settings } = useContext(ScrollViewSettingsContext)
  const effectiveBlur = useBlur(blur)
  const effectiveSnapBack = snapBack ?? settings.snapBack
  const effectiveSnapBackHeader = snapBackHeader ?? settings.snapBackHeader
  const effectiveSnapBackFooter = snapBackFooter ?? settings.snapBackFooter
  const [headerHeight, setHeaderHeightState] = useState(0)
  const [footerHeight, setFooterHeightState] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressing, setProgressing] = useState(false)
  const scrollPosition = useSharedValue(0)
  const headerHeightShared = useSharedValue(0)
  const footerHeightShared = useSharedValue(0)
  const headerOffset = useSharedValue(0)
  const footerOffset = useSharedValue(0)
  const pullSearchHeightShared = useSharedValue(0)
  const snapBackHeaderShared = useSharedValue(false)
  const snapBackFooterShared = useSharedValue(false)
  useEffect(() => {
    snapBackHeaderShared.value = effectiveSnapBackHeader ?? effectiveSnapBack
    snapBackFooterShared.value = effectiveSnapBackFooter ?? effectiveSnapBack
  }, [effectiveSnapBack, effectiveSnapBackFooter, effectiveSnapBackHeader, snapBackFooterShared, snapBackHeaderShared])
  const setHeaderHeight = useCallback(
    (h: number) => {
      setHeaderHeightState(h)
      headerHeightShared.value = h
    },
    [headerHeightShared]
  )
  const setFooterHeight = useCallback(
    (h: number) => {
      setFooterHeightState(h)
      footerHeightShared.value = h
    },
    [footerHeightShared]
  )
  const scrollHeight = useMemo(() => Dimensions.get('window').height - headerHeight - footerHeight, [headerHeight, footerHeight])
  const effectiveHeaderFixed = fixed || (headerFixed ?? settings.headerFixed)
  const effectiveFooterFixed = fixed || (footerFixed ?? settings.footerFixed)
  const value = useMemo(() => ({ blur: effectiveBlur, footerHeight, footerHeightShared, footerFixed: effectiveFooterFixed, footerOffset, headerHeight, headerHeightShared, headerFixed: effectiveHeaderFixed, headerOffset, progress, pullSearchHeightShared, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, setProgress, setProgressing, snapBackFooterShared, snapBackHeaderShared, tabBarHeight }), [effectiveBlur, effectiveFooterFixed, effectiveHeaderFixed, footerHeight, footerHeightShared, footerOffset, headerHeight, headerHeightShared, headerOffset, progress, pullSearchHeightShared, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, snapBackFooterShared, snapBackHeaderShared, tabBarHeight])
  return <ScrollViewContext.Provider value={value}>{children}</ScrollViewContext.Provider>
}
