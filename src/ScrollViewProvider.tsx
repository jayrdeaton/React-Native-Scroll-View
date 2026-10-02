import { useBlur } from '@rific/auto-paper'
import { type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, Platform } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { CHROME_SLACK } from './internal/chrome'
import { ChromeRegistrar } from './internal/ChromeRegistrar'
import { ScrollViewChromeHostContext } from './ScrollViewChromeContext'
import { ScrollViewContext } from './ScrollViewContext'
import { ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export type ScrollViewProviderProps = {
  blur?: boolean
  // Opt out of an enclosing ScrollViewChromeProvider. A screen inside a hosted navigator joins the
  // host by default; a nested provider that is NOT a screen (a picker or form modal — Paper's Portal
  // can re-parent those above the clearing this provider does for its own children) has to say so.
  chrome?: boolean
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

export const ScrollViewProvider = ({ blur, chrome, children, fixed = false, footerAboveKeyboard = false, footerFixed, headerFixed, snapBack, snapBackFooter, snapBackHeader, tabBarHeight = 0 }: ScrollViewProviderProps) => {
  const { settings } = useContext(ScrollViewSettingsContext)
  const enclosingHost = useContext(ScrollViewChromeHostContext)
  const chromeHost = chrome === false ? null : enclosingHost
  const chromeHosted = chromeHost !== null
  const chromeFootprint = chromeHost?.footprint ?? 0
  const chromeOverhang = chromeHost?.overhang ?? 0
  const chromeSnapBack = chromeHost?.snapBack ?? false
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
  const ownFooterOffset = useSharedValue(0)
  const ownStackHeight = useSharedValue(0)
  // A hosted provider writes the host's ONE offset instead of its own, so the persistent bar and this
  // screen's footer read literally the same SharedValue. Starts unwritable when hosted: the
  // registrar flips it once this screen actually owns the host, so a mounted-but-unfocused screen
  // (Tabs and Stacks keep visited screens mounted) can never fight the focused one for it.
  const footerOffset = chromeHost ? chromeHost.offset : ownFooterOffset
  const chromeWritable = useSharedValue(!chromeHosted)
  // Only the registrar ever writes this while hosted. If a provider stops being hosted while it stays
  // mounted (chrome flipping to false, the host unmounting), the registrar goes away with it and
  // would leave the last value behind — possibly false, which would silently switch off this
  // provider's own snap-back footer for good.
  useEffect(() => {
    if (!chromeHosted) chromeWritable.value = true
  }, [chromeHosted, chromeWritable])
  const revealChrome = chromeHost?.reveal
  // Unhosted, the hide distance is simply the footer's own height — the SAME SharedValue, not a
  // copy, so nothing about existing snap-back behavior changes. Hosted, the whole stack (screen
  // footer + bar + whatever pokes above the bar) has to clear the screen, and the footer's own
  // measured height already includes the overhang as its bottom padding.
  const stackHeightShared = chromeHosted ? ownStackHeight : footerHeightShared
  const pullSearchHeightShared = useSharedValue(0)
  const snapBackHeaderShared = useSharedValue(false)
  const snapBackFooterShared = useSharedValue(false)
  useEffect(() => {
    snapBackHeaderShared.value = effectiveSnapBackHeader ?? effectiveSnapBack
    // Forced on for a hosted footer only: a bar that hides on scroll must be revealable from
    // anywhere in a list, which the non-snap footer (visible only near the top) is not. The header's
    // own snap-back is deliberately left to its own setting.
    snapBackFooterShared.value = chromeHosted ? chromeSnapBack : (effectiveSnapBackFooter ?? effectiveSnapBack)
  }, [chromeHosted, chromeSnapBack, effectiveSnapBack, effectiveSnapBackFooter, effectiveSnapBackHeader, snapBackFooterShared, snapBackHeaderShared])
  useEffect(() => {
    if (!chromeHosted) return
    ownStackHeight.value = chromeFootprint + Math.max(footerHeight ?? 0, chromeOverhang) + CHROME_SLACK
  }, [chromeFootprint, chromeHosted, chromeOverhang, footerHeight, ownStackHeight])
  // The last height each setter below accepted, written synchronously on every call. The 0-guards
  // read these rather than the rendered headerHeight/footerHeight, because a caller can hold a
  // setter from before the previous call committed: on web the header's first onLayout and the
  // fallback below routinely land ~2ms apart in the same frame, and the fallback's closure still
  // saw headerHeight === null, so its 0 passed the guard and overwrote the real height. The header's
  // size never changed after that, so onLayout never fired again and the list kept 0 top padding
  // under the header for good.
  const headerHeightRef = useRef<number | null>(null)
  const footerHeightRef = useRef<number | null>(null)
  const setHeaderHeight = useCallback((h: number | null) => {
    // react-native-screens' web shim hides an inactive screen via display:none on an
    // ancestor instead of unmounting it, so the header's ResizeObserver-backed onLayout
    // keeps firing while hidden and reports a spurious 0 (no layout box), then again once
    // revealed. Never let a spurious 0 clobber a real height — only a true remount
    // (headerHeight reset to null) should ever legitimately shrink it back to 0.
    if (h === 0 && headerHeightRef.current) return
    headerHeightRef.current = h
    setHeaderHeightState(h)
  }, [])
  // Mirrored into the SharedValue in the same commit as the state, never ahead of it. Writing it
  // straight from onLayout let the header's translate worklet see the new height while the list
  // still had no top padding and scrollPosition hadn't been moved to its resting -headerHeight
  // (useScrollInit does that in its own layout effect on this commit) — so for the whole re-render
  // (~50ms on web) the header computed translateY = -headerHeight and slid off-screen, a visible
  // flash of a header-less screen with the list's first rows at the very top.
  useLayoutEffect(() => {
    headerHeightShared.value = headerHeight ?? 0
  }, [headerHeight, headerHeightShared])
  const onListUnmount = useCallback(() => {
    listGeneration.value += 1
    // The owning screen's list going away is the last scroll source for the shared offset: a screen
    // that swaps its list for non-scrolling content (a spinner, an empty state) while the stack is
    // hidden would otherwise keep the app's primary navigation hidden with nothing left to bring it back.
    if (revealChrome && chromeWritable.value) revealChrome()
  }, [chromeWritable, listGeneration, revealChrome])
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
  // Web-only recovery for a real race: a header's ResizeObserver-backed onLayout can simply never
  // fire on the very first mount through Expo Router (observed in practice, not just theorized —
  // content stuck at opacity: 0 indefinitely, with no error, only escaping via an unrelated resize
  // forcing a fresh layout pass). Native RN doesn't have this race — onLayout is reliable there, and
  // a persistently-null headerHeight really does mean "no header was ever rendered," which the
  // warning above should keep flagging. On web, give a real first layout two frames to arrive before
  // assuming there isn't one; setHeaderHeight(0) is exactly what a genuinely header-less screen would
  // report anyway, so this is indistinguishable from that case once it fires.
  useEffect(() => {
    if (Platform.OS !== 'web' || headerHeight !== null) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setHeaderHeight(0))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [headerHeight, setHeaderHeight])
  const setFooterHeight = useCallback(
    (h: number | null) => {
      // Same race setHeaderHeight guards against, on the footer side: react-native-screens' web
      // shim (and a footer's own unmount cleanup below, which now passes null instead of 0 for
      // exactly this reason) can report/force a spurious 0 while a real footer is effectively
      // still on screen (e.g. a wizard cycling through several <ScrollViewFooter> instances).
      // Never let that clobber a known height — only an explicit null (genuinely no footer
      // mounted) may reset it.
      if (h === 0 && footerHeightRef.current) return
      footerHeightRef.current = h
      setFooterHeightState(h)
      footerHeightShared.value = h ?? 0
    },
    [footerHeightShared]
  )
  const scrollHeight = useMemo(() => Dimensions.get('window').height - (headerHeight ?? 0) - (footerHeight ?? 0), [headerHeight, footerHeight])
  const effectiveHeaderFixed = fixed || (headerFixed ?? settings.headerFixed)
  const effectiveFooterFixed = fixed || (footerFixed ?? settings.footerFixed)
  // Hosted, the persistent bar's footprint replaces the consumer's static tabBarHeight guess: it is
  // the same "reserve this much at the bottom" number, just now known exactly.
  const effectiveTabBarHeight = chromeHosted ? chromeFootprint : tabBarHeight
  const value = useMemo(
    () => ({ blur: effectiveBlur, chromeHosted, chromeOverhang, chromeWritable, footerAboveKeyboard, footerHeight, footerHeightShared, footerFixed: effectiveFooterFixed, footerOffset, headerHeight, headerHeightShared, headerFixed: effectiveHeaderFixed, headerOffset, jsListGeneration, listGeneration, onJsListUnmount, onListUnmount, progress, pullSearchHeightShared, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, setProgress, setProgressing, snapBackFooterShared, snapBackHeaderShared, stackHeightShared, tabBarHeight: effectiveTabBarHeight }),
    [effectiveBlur, chromeHosted, chromeOverhang, chromeWritable, footerAboveKeyboard, effectiveFooterFixed, effectiveHeaderFixed, footerHeight, footerHeightShared, footerOffset, headerHeight, headerHeightShared, headerOffset, jsListGeneration, listGeneration, onJsListUnmount, onListUnmount, progress, pullSearchHeightShared, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, snapBackFooterShared, snapBackHeaderShared, stackHeightShared, effectiveTabBarHeight]
  )
  return (
    <ScrollViewContext.Provider value={value}>
      <ScrollViewChromeHostContext.Provider value={null}>
        {children}
        {chromeHost ? <ChromeRegistrar footerFixed={effectiveFooterFixed} host={chromeHost} writable={chromeWritable} /> : null}
      </ScrollViewChromeHostContext.Provider>
    </ScrollViewContext.Provider>
  )
}
