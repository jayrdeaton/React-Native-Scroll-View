import { useBlur } from '@rific/auto-paper'
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { ScrollViewContext } from './ScrollViewContext'
import { ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export type ScrollViewProviderProps = {
  blur?: boolean
  children: ReactNode
  fixed?: boolean
  footerAboveKeyboard?: boolean
  footerFixed?: boolean
  headerFixed?: boolean
  snapBack?: boolean
  snapBackFooter?: boolean
  snapBackHeader?: boolean
  tabBarHeight?: number
}

export const ScrollViewProvider = ({ blur, children, fixed = false, footerAboveKeyboard = false, footerFixed, headerFixed, snapBack, snapBackFooter, snapBackHeader, tabBarHeight = 0 }: ScrollViewProviderProps) => {
  const { settings } = useContext(ScrollViewSettingsContext)
  const effectiveBlur = useBlur(blur)
  const effectiveSnapBack = snapBack ?? settings.snapBack
  const effectiveSnapBackHeader = snapBackHeader ?? settings.snapBackHeader
  const effectiveSnapBackFooter = snapBackFooter ?? settings.snapBackFooter
  const [headerHeight, setHeaderHeightState] = useState<number | null>(null)
  const [footerHeight, setFooterHeightState] = useState<number | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressing, setProgressing] = useState(false)
  const scrollPosition = useSharedValue(0)
  const listGeneration = useSharedValue(0)
  const jsListGeneration = useRef(0)
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
    (h: number | null) => {
      // react-native-screens' web shim hides an inactive screen via display:none on an
      // ancestor instead of unmounting it, so the header's ResizeObserver-backed onLayout
      // keeps firing while hidden and reports a spurious 0 (no layout box), then again once
      // revealed. Never let a spurious 0 clobber a real height — only a true remount
      // (headerHeight reset to null) should ever legitimately shrink it back to 0.
      if (h === 0 && headerHeight) return
      setHeaderHeightState(h)
      headerHeightShared.value = h ?? 0
    },
    [headerHeight, headerHeightShared]
  )
  const onListUnmount = useCallback(() => {
    listGeneration.value += 1
  }, [listGeneration])
  const onJsListUnmount = useCallback(() => {
    jsListGeneration.current += 1
  }, [])
  useEffect(() => {
    if (!__DEV__ || headerHeight !== null) return
    const timeout = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[scroll-view] No ScrollViewHeader ever measured inside this ScrollViewProvider — scroll content stays hidden (opacity: 0) until one does. Render a <ScrollViewHeader> (it can be empty / zero height) inside this provider.')
    }, 3000)
    return () => clearTimeout(timeout)
  }, [headerHeight])
  const setFooterHeight = useCallback(
    (h: number | null) => {
      // Same race setHeaderHeight guards against, on the footer side: react-native-screens' web
      // shim (and a footer's own unmount cleanup below, which now passes null instead of 0 for
      // exactly this reason) can report/force a spurious 0 while a real footer is effectively
      // still on screen (e.g. a wizard cycling through several <ScrollViewFooter> instances).
      // Never let that clobber a known height — only an explicit null (genuinely no footer
      // mounted) may reset it.
      if (h === 0 && footerHeight) return
      setFooterHeightState(h)
      footerHeightShared.value = h ?? 0
    },
    [footerHeight, footerHeightShared]
  )
  const scrollHeight = useMemo(() => Dimensions.get('window').height - (headerHeight ?? 0) - (footerHeight ?? 0), [headerHeight, footerHeight])
  const effectiveHeaderFixed = fixed || (headerFixed ?? settings.headerFixed)
  const effectiveFooterFixed = fixed || (footerFixed ?? settings.footerFixed)
  const value = useMemo(() => ({ blur: effectiveBlur, footerAboveKeyboard, footerHeight, footerHeightShared, footerFixed: effectiveFooterFixed, footerOffset, headerHeight, headerHeightShared, headerFixed: effectiveHeaderFixed, headerOffset, jsListGeneration, listGeneration, onJsListUnmount, onListUnmount, progress, pullSearchHeightShared, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, setProgress, setProgressing, snapBackFooterShared, snapBackHeaderShared, tabBarHeight }), [effectiveBlur, footerAboveKeyboard, effectiveFooterFixed, effectiveHeaderFixed, footerHeight, footerHeightShared, footerOffset, headerHeight, headerHeightShared, headerOffset, jsListGeneration, listGeneration, onJsListUnmount, onListUnmount, progress, pullSearchHeightShared, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, snapBackFooterShared, snapBackHeaderShared, tabBarHeight])
  return <ScrollViewContext.Provider value={value}>{children}</ScrollViewContext.Provider>
}
