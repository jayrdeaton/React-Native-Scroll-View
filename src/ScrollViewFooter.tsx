import { BlurView } from '@rific/auto-paper'
import { type ReactNode, useContext, useEffect, useRef } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'
import { useKeyboardInset } from './useKeyboardInset'

export type ScrollViewFooterProps = {
  children?: ReactNode | ReactNode[]
  style?: ViewStyle
}

export const ScrollViewFooter = ({ children, style }: ScrollViewFooterProps) => {
  const { blur, footerAboveKeyboard, footerHeight, footerFixed, footerOffset, headerHeightShared, pullSearchHeightShared, scrollPosition, setFooterHeight, snapBackFooterShared, tabBarHeight } = useContext(ScrollViewContext)
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardInset()
  // setFooterHeight's own identity changes on every real measurement (ScrollViewProvider's
  // useCallback closes over `footerHeight` itself, so setting it recreates the callback). Depending
  // on it directly here re-ran this effect on every measurement too — tearing down the PREVIOUS
  // closure as a "cleanup" and calling ITS setFooterHeight(null) right after the real height had
  // just been set, permanently clobbering it back to null with no further layout event left to
  // recover it (the DOM node's true size never changed, so onLayout never fires again). Reading
  // through a ref sidesteps that: the effect itself only ever runs once, on mount/unmount, so its
  // cleanup fires exactly when it's meant to (a real unmount) rather than after every measurement.
  const setFooterHeightRef = useRef(setFooterHeight)
  setFooterHeightRef.current = setFooterHeight
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
    if (footerFixed) return { transform: [{ translateY: 0 }] }
    if (snapBackFooterShared.value) return { transform: [{ translateY: footerOffset.value }] }
    const effective = scrollPosition.value + headerHeightShared.value - pullSearchHeightShared.value
    if (effective <= 0) return { transform: [{ translateY: 0 }] }
    return { transform: [{ translateY: Math.min(effective, footerHeight ?? 0) }] }
  }, [footerHeight, footerFixed, headerHeightShared, pullSearchHeightShared, scrollPosition, snapBackFooterShared, footerOffset])
  // Floating above the keyboard is done by GROWING this container (via paddingBottom) rather than
  // translating it. Translating the whole bar left its bottom edge — and the BlurView filling it —
  // floating above the true screen bottom, exposing a gap of whatever sits behind (visible as a
  // strip above the keyboard, and worse at the keyboard's rounded top corners, which dip below its
  // reported height). Growing the container instead keeps its `bottom: 0` anchor untouched: the
  // blur backdrop always reaches all the way to the physical edge, sealing that gap entirely,
  // while the extra height pushes the row (this bar's actual content) up by keyboardHeight, same
  // as the old translateY did for it.
  const containerPaddingBottom = footerFixed && footerAboveKeyboard ? keyboardHeight : 0
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
  const rowPaddingBottom = footerFixed && footerAboveKeyboard ? Math.max(insets.bottom - keyboardHeight, 0) : insets.bottom
  return (
    // bottom: tabBarHeight (not the styles.footer default of 0) - a consuming app's own persistent
    // tab bar (a fixture outside this package's header/footer concepts entirely, same as
    // useScrollList's content-inset reservation) sits below this at the true screen bottom, so this
    // bar has to clear it rather than rendering flush against 0 and overlapping/hiding behind it.
    <Animated.View onLayout={handleLayout} pointerEvents='box-none' style={[styles.footer, { bottom: tabBarHeight, paddingBottom: containerPaddingBottom }, footerStyle]}>
      {(footerHeight ?? 0) > 0 && <BlurView blur={blur} style={StyleSheet.absoluteFill} />}
      <View style={[styles.row, { paddingBottom: rowPaddingBottom }, style]}>{children}</View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  footer: { left: 0, position: 'absolute', right: 0, zIndex: 2 },
  row: { alignItems: 'center', flexDirection: 'row', zIndex: 1 }
})
