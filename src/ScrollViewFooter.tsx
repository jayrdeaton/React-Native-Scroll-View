import { BlurView } from '@rific/auto-paper'
import { type ReactNode, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { type LayoutChangeEvent, Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'
import { useKeyboardInset } from './useKeyboardInset'

export type ScrollViewFooterProps = {
  children?: ReactNode | ReactNode[]
  style?: ViewStyle
}

export const ScrollViewFooter = ({ children, style }: ScrollViewFooterProps) => {
  const { blur, chromeHosted, chromeOverhang, footerAboveKeyboard, footerHeight, footerFixed, footerOffset, headerHeightShared, pullSearchHeightShared, scrollPosition, setFooterHeight, snapBackFooterShared, stackHeightShared, tabBarHeight } = useContext(ScrollViewContext)
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardInset()
  // setFooterHeight used to change identity on every real measurement (ScrollViewProvider's
  // useCallback closed over `footerHeight` itself). Depending on it directly here re-ran this
  // effect on every measurement too — tearing down the PREVIOUS closure as a "cleanup" and calling
  // ITS setFooterHeight(null) right after the real height had just been set, permanently clobbering
  // it back to null with no further layout event left to recover it (the DOM node's true size never
  // changed, so onLayout never fires again). The provider's setter is stable now, but the context
  // type doesn't promise that, so this still reads through a ref: the effect itself only ever runs
  // once, on mount/unmount, so its cleanup fires exactly when it's meant to (a real unmount).
  // The mirror below has to be effect-based too, not a bare render-time assignment: writing to the
  // ref during render is a React-render-purity violation (render can be discarded/replayed), so it's
  // done in its own no-deps effect, which still re-runs on every commit and keeps the ref current.
  const setFooterHeightRef = useRef(setFooterHeight)
  useEffect(() => {
    setFooterHeightRef.current = setFooterHeight
  })
  useEffect(
    () => () => {
      setFooterHeightRef.current(null)
    },
    []
  )
  const handleLayout = ({
    nativeEvent: {
      layout: { height }
    }
  }: LayoutChangeEvent) => {
    if (footerHeight !== height) setFooterHeight(height)
  }
  // See ScrollViewHeader's translateStyle/blurStyle/progressStyle for why every SharedValue read
  // here (scrollPosition, headerHeightShared, pullSearchHeightShared, snapBackFooterShared,
  // footerOffset) also has to be listed explicitly — on web, reanimated doesn't pick up their
  // mutations as reactive triggers unless they're in this array, unlike native.
  const footerStyle = useAnimatedStyle(() => {
    // Hosted, the offset is the ONE value the persistent bar translates by too, so it is always
    // read straight through — never short-circuited to 0 for footerFixed the way the unhosted path
    // below is. Footer Lock reaches it by animating the shared offset back to 0 instead (see
    // ChromeRegistrar), which keeps this footer and the bar equal on every frame, including the
    // ones where one would otherwise jump and the other animate.
    if (chromeHosted) return { transform: [{ translateY: Math.min(Math.max(footerOffset.value, 0), stackHeightShared.value) }] }
    if (footerFixed) return { transform: [{ translateY: 0 }] }
    if (snapBackFooterShared.value) return { transform: [{ translateY: footerOffset.value }] }
    const effective = scrollPosition.value + headerHeightShared.value - pullSearchHeightShared.value
    if (effective <= 0) return { transform: [{ translateY: 0 }] }
    return { transform: [{ translateY: Math.min(effective, footerHeight ?? 0) }] }
  }, [chromeHosted, footerHeight, footerFixed, headerHeightShared, pullSearchHeightShared, scrollPosition, snapBackFooterShared, footerOffset, stackHeightShared])
  // Floating above the keyboard is done by GROWING this container (via paddingBottom) rather than
  // translating it. Translating the whole bar left its bottom edge — and the BlurView filling it —
  // floating above the true screen bottom, exposing a gap of whatever sits behind (visible as a
  // strip above the keyboard, and worse at the keyboard's rounded top corners, which dip below its
  // reported height). Growing the container instead keeps its `bottom: 0` anchor untouched: the
  // blur backdrop always reaches all the way to the physical edge, sealing that gap entirely,
  // while the extra height pushes the row (this bar's actual content) up by keyboardHeight, same
  // as the old translateY did for it.
  const containerPaddingBottom = footerFixed && footerAboveKeyboard ? keyboardHeight : 0
  // Web only, same as ScrollViewHeader's pre-paint measurement: react-native-web's onLayout lands
  // well after the first paint (a ResizeObserver callback plus a setTimeout measure — over a second
  // on a cold load), and until footerHeight is known this footer draws no backdrop (see the
  // BlurView gate below) and the list reserves no room for it, so the row floated bare over the
  // content and its bar only appeared once the measurement arrived. Measuring the row here, after
  // the DOM is built but before the browser paints, makes the very first frame the final one. The
  // container's own height is the row plus containerPaddingBottom, which is what onLayout reports,
  // so that later onLayout is a no-op. A node with no layout box (hidden ancestor) reports 0 and
  // is left to onLayout; a footer mounting while another's height is already known does too.
  const rowRef = useRef<View>(null)
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || footerHeight) return
    const height = (rowRef.current as unknown as { offsetHeight?: unknown } | null)?.offsetHeight
    if (typeof height !== 'number' || height <= 0) return
    setFooterHeight(height + containerPaddingBottom)
    // Mount-only: after this, onLayout owns every later change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The safe-area bottom inset exists to clear the home indicator at the physical screen edge.
  // Once footerAboveKeyboard has floated this bar's content up above an open keyboard, it's no
  // longer sitting at that edge — the keyboard itself now occupies that space — so the inset would
  // just be dead space under the content (e.g. under a Save button) for no reason.
  //
  // This has to ramp continuously with keyboardHeight, not flip as a boolean once the keyboard
  // fully closes: containerPaddingBottom above already tracks keyboardHeight every frame, so a
  // step-function padding change here lands in the same frame keyboardHeight hits 0, growing this
  // row by insets.bottom right as the container finishes shrinking back down — the content visually
  // overshoots to the physical bottom edge and then snaps back up. Ramping this padding by the same
  // keyboardHeight keeps the content's on-screen position moving continuously throughout: for
  // keyboardHeight >= insets.bottom the padding is 0 (unchanged from mid-close), and for the last
  // insets.bottom worth of keyboard travel, containerPaddingBottom's continued shrink and this
  // padding's growth cancel out exactly, so the content holds still at the safe-area line instead
  // of dropping past it and correcting back up.
  //
  // Hosted, the bar (which already includes the safe-area inset in its own footprint) sits below
  // this footer, so the row's bottom padding is only what pokes above the bar (a FAB) — not the
  // inset a second time.
  const bottomPadding = chromeHosted ? chromeOverhang : insets.bottom
  const rowPaddingBottom = footerFixed && footerAboveKeyboard ? Math.max(bottomPadding - keyboardHeight, 0) : bottomPadding
  // A hosted, keyboard-floating footer would otherwise float a whole bar-height above the keyboard:
  // containerPaddingBottom above already lifts it by keyboardHeight, on top of `bottom: footprint`.
  // The bar it was clearing is behind the keyboard by then, so the footprint has to shrink away as
  // the keyboard rises.
  const footerBottom = chromeHosted && footerFixed && footerAboveKeyboard ? Math.max(tabBarHeight - keyboardHeight, 0) : tabBarHeight
  // A consumer's own `style.paddingBottom` (e.g. tightening the row's vertical rhythm to match a
  // header's actionMargin) is spread after rowPaddingBottom below, so it has to be added to it
  // rather than assigned after it — plain style-array merge would otherwise let it silently
  // replace the safe-area clearance instead of sitting on top of it, leaving the row's real
  // content (buttons, etc.) flush against the home indicator.
  const { paddingBottom: consumerPaddingBottom, ...restStyle } = style ?? {}
  return (
    // bottom: tabBarHeight (not the styles.footer default of 0) - a consuming app's own persistent
    // tab bar (a fixture outside this package's header/footer concepts entirely, same as
    // useScrollList's content-inset reservation) sits below this at the true screen bottom, so this
    // bar has to clear it rather than rendering flush against 0 and overlapping/hiding behind it.
    <Animated.View onLayout={handleLayout} pointerEvents='box-none' style={[styles.footer, { bottom: footerBottom, paddingBottom: containerPaddingBottom }, footerStyle]}>
      {(footerHeight ?? 0) > 0 && <BlurView blur={blur} style={StyleSheet.absoluteFill} />}
      <View ref={rowRef} style={[styles.row, restStyle, { paddingBottom: rowPaddingBottom + (typeof consumerPaddingBottom === 'number' ? consumerPaddingBottom : 0) }]}>
        {children}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  footer: { left: 0, position: 'absolute', right: 0, zIndex: 2 },
  row: { alignItems: 'center', flexDirection: 'row', zIndex: 1 }
})
