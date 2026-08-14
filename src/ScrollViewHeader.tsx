import { BlurView } from '@rific/auto-paper'
import { type ReactNode, useContext } from 'react'
import { type LayoutChangeEvent, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Appbar, ProgressBar, Surface, useTheme } from 'react-native-paper'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'
import { ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export type ScrollViewHeaderProps = {
  actionSize?: number
  actionStyle?: ViewStyle
  // A plain callback renders the default Appbar.BackAction (themed onSurface, sized/positioned by
  // actionSize/iconSize below) — the common case, unchanged from before. Passing a ReactNode
  // instead skips that default entirely and renders the given element in its place, same escape
  // hatch trailingAction already gave the other corner: a caller that wants its own color, icon,
  // or component altogether (a colored IconButton, say) isn't stuck fighting Appbar.BackAction's
  // own fixed color/no-customization API to get it. backActionAccessibilityLabel/iconSize below
  // only apply to the default-rendered case — a custom element carries its own.
  backAction?: (() => void) | ReactNode
  backActionAccessibilityLabel?: string
  backActionFixed?: boolean
  caption?: string
  centerContent?: ReactNode
  children?: ReactNode | ReactNode[]
  iconSize?: number
  style?: ViewStyle
  title?: string
  topInset?: boolean
  trailingAction?: ReactNode
  trailingActionFixed?: boolean
}

type ActionBgProps = { blur: boolean; style?: ViewStyle }

const ActionBg = ({ blur, style }: ActionBgProps) =>
  blur ? (
    <View style={[StyleSheet.absoluteFill, styles.actionBg, style]}>
      <BlurView blur style={StyleSheet.absoluteFill} />
    </View>
  ) : (
    <View style={[StyleSheet.absoluteFill, styles.actionBg, style]} pointerEvents='none'>
      <Surface style={StyleSheet.absoluteFill} elevation={1}>
        {null}
      </Surface>
    </View>
  )

export const ScrollViewHeader = ({ actionSize = 48, actionStyle, backAction, backActionAccessibilityLabel, backActionFixed, caption, centerContent, children, iconSize, style, title, topInset = true, trailingAction, trailingActionFixed = true }: ScrollViewHeaderProps) => {
  const { blur, headerHeight, headerFixed, headerHeightShared, headerOffset, progress, progressing, pullSearchHeightShared, scrollPosition, setHeaderHeight, snapBackHeaderShared } = useContext(ScrollViewContext)
  const { settings } = useContext(ScrollViewSettingsContext)
  const effectiveBackActionFixed = backActionFixed ?? settings.backActionFixed
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const top = topInset ? insets.top : 0
  // Tracks "has this header's own onLayout fired yet" as a SharedValue rather than deriving it from
  // headerHeight (a plain, React-state-backed number) so the worklets below never have to list a
  // value that flips from null to a real measured number in their dependency arrays — see the
  // comment on translateStyle/blurStyle/progressStyle for why that recreation was a real crash, not
  // just a perf concern.
  const measuredShared = useSharedValue(false)
  const handleLayout = ({
    nativeEvent: {
      layout: { height }
    }
  }: LayoutChangeEvent) => {
    measuredShared.value = true
    if (headerHeight !== height) setHeaderHeight(height)
  }
  const actionMargin = 4
  const contentMinHeight = actionSize + 2 * actionMargin
  // Same natural height the header renders at in-flow before headerHeight is ever measured (see
  // useScrollList's containerStyle comment for that same "in-flow first, absolute once measured"
  // pattern) — used as the blur backdrop's own height for that same pre-measurement window, so it
  // doesn't render as a flat, unblurred box for the ~60-80ms an onLayout round trip takes on web.
  const unmeasuredHeight = top + contentMinHeight
  // Every one of these worklets reads SharedValues only (scrollPosition, snapBackHeaderShared,
  // headerOffset, pullSearchHeightShared, headerHeightShared, measuredShared) — deliberately NOT the
  // plain `headerHeight` context value, even though it holds the same number. `headerHeight` is a
  // React-state-backed `number | null` that changes identity on every measurement (starting at null,
  // then flipping to a real pixel value within a frame of mount); putting it in a useAnimatedStyle
  // dependency array forces Reanimated to tear down and recreate the worklet the moment that happens
  // — which crashed outright ("[Worklets] Tried to synchronously call a Remote Function") on
  // react-native-worklets 0.10.1. SharedValues never change identity, only their `.value`, so they're
  // safe to depend on and don't retrigger this. They still have to be LISTED here despite that: on
  // web, without the Reanimated Babel plugin's automatic worklet dependency capture, a SharedValue's
  // mutations aren't picked up as reactive unless its reference appears in this array — omitting one
  // silently freezes that value's contribution to the header/blur/progress-bar's scroll tracking at
  // whatever it was when the array last changed.
  const translateStyle = useAnimatedStyle(() => {
    if (headerFixed) return { transform: [{ translateY: 0 }] }
    if (snapBackHeaderShared.value) return { transform: [{ translateY: headerOffset.value }] }
    const effective = scrollPosition.value + headerHeightShared.value - pullSearchHeightShared.value
    if (effective <= 0) return { transform: [{ translateY: 0 }] }
    return { transform: [{ translateY: -effective }] }
  }, [headerFixed, headerHeightShared, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared])
  const blurStyle = useAnimatedStyle(() => {
    if (!measuredShared.value) return { height: unmeasuredHeight }
    if (!headerHeightShared.value) return { height: 0 }
    if (headerFixed) return { height: headerHeightShared.value }
    const translateY = snapBackHeaderShared.value ? headerOffset.value : -Math.max(0, scrollPosition.value + headerHeightShared.value - pullSearchHeightShared.value)
    return { height: Math.max(headerHeightShared.value + translateY, top) }
  }, [headerFixed, top, unmeasuredHeight, measuredShared, headerHeightShared, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared])
  const progressStyle = useAnimatedStyle(() => {
    const h = headerHeightShared.value
    if (headerFixed) return { top: h }
    const slide = snapBackHeaderShared.value ? -headerOffset.value : Math.max(0, scrollPosition.value + h - pullSearchHeightShared.value)
    return { top: Math.max(h - slide, top) }
  }, [headerFixed, headerHeightShared, top, headerOffset, pullSearchHeightShared, scrollPosition, snapBackHeaderShared])
  const actionTop = top + actionMargin
  const buttonStyle = { borderRadius: actionSize, height: actionSize, margin: 0, width: actionSize }
  const actionShadow = { borderRadius: actionSize / 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
  const leadingStyle = { alignItems: 'center' as const, height: actionSize, justifyContent: 'center' as const, left: actionMargin, position: 'absolute' as const, top: actionTop, width: actionSize, zIndex: 3, ...actionShadow }
  const trailingStyle = { alignItems: 'center' as const, height: actionSize, justifyContent: 'center' as const, position: 'absolute' as const, right: actionMargin, top: actionTop, width: actionSize, zIndex: 3, ...actionShadow }
  return (
    <>
      <Animated.View pointerEvents='none' style={[styles.blur, blurStyle]}>
        {headerHeight !== 0 && <BlurView blur={blur} style={[styles.blurInner, { height: headerHeight ?? unmeasuredHeight }]} />}
      </Animated.View>
      <Animated.View onLayout={handleLayout} pointerEvents='box-none' style={[headerHeight === null ? styles.headerInit : styles.header, translateStyle]}>
        <View style={[{ paddingTop: top }, style]}>
          {children ?? (
            <View style={[styles.content, { minHeight: contentMinHeight }]}>
              <View style={styles.side} />
              <View style={styles.spacer} />
              {(centerContent || title || caption) && (
                <View style={[StyleSheet.absoluteFill, styles.titleContainer]} pointerEvents={centerContent ? 'box-none' : 'none'}>
                  {centerContent ?? (
                    <>
                      {title && (
                        <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
                          {title}
                        </Text>
                      )}
                      {caption && (
                        <Text numberOfLines={1} style={[styles.caption, { color: theme.colors.onSurfaceVariant }]}>
                          {caption}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
        {!blur && <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />}
      </Animated.View>
      <Animated.View pointerEvents='none' style={[styles.progress, progressStyle]}>
        <ProgressBar indeterminate={progress === null} visible={progressing} progress={progress ?? undefined} />
      </Animated.View>
      {backAction &&
        (effectiveBackActionFixed ? (
          <Animated.View style={leadingStyle}>
            <ActionBg blur={blur} style={actionStyle} />
            {typeof backAction === 'function' ? <Appbar.BackAction accessibilityLabel={backActionAccessibilityLabel} onPress={backAction} size={iconSize ?? actionSize / 2} style={buttonStyle} /> : backAction}
          </Animated.View>
        ) : (
          <Animated.View style={[leadingStyle, translateStyle]}>
            <ActionBg blur={blur} style={actionStyle} />
            {typeof backAction === 'function' ? <Appbar.BackAction accessibilityLabel={backActionAccessibilityLabel} onPress={backAction} size={iconSize ?? actionSize / 2} style={buttonStyle} /> : backAction}
          </Animated.View>
        ))}
      {trailingAction &&
        (trailingActionFixed ? (
          <View style={trailingStyle}>
            <ActionBg blur={blur} style={actionStyle} />
            {trailingAction}
          </View>
        ) : (
          <Animated.View style={[trailingStyle, translateStyle]}>
            <ActionBg blur={blur} style={actionStyle} />
            {trailingAction}
          </Animated.View>
        ))}
    </>
  )
}

const styles = StyleSheet.create({
  actionBg: { borderRadius: 100, overflow: 'hidden' },
  divider: { bottom: 0, height: StyleSheet.hairlineWidth, left: 0, position: 'absolute', right: 0 },
  caption: { fontSize: 12, fontWeight: '400', textAlign: 'center' },
  content: { alignItems: 'center', flexDirection: 'row', width: '100%' },
  blur: { left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0, zIndex: 2 },
  blurInner: { left: 0, position: 'absolute', right: 0, top: 0 },
  header: { left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0, zIndex: 2 },
  headerInit: { left: 0, overflow: 'hidden', right: 0, zIndex: 2 },
  progress: { left: 0, position: 'absolute', right: 0, zIndex: 3 },
  side: { alignItems: 'center', flexDirection: 'row' },
  spacer: { flex: 1 },
  title: { fontSize: 20, fontWeight: '400', textAlign: 'center' },
  titleContainer: { alignItems: 'center', justifyContent: 'center' }
})
