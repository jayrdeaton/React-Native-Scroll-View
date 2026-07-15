import { BlurView } from '@rific/auto-paper'
import { type ReactNode, useContext } from 'react'
import { type LayoutChangeEvent, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Appbar, ProgressBar, Surface, useTheme } from 'react-native-paper'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'
import { ScrollViewSettingsContext } from './ScrollViewSettingsContext'

export type ScrollViewHeaderProps = {
  actionSize?: number
  actionStyle?: ViewStyle
  backAction?: () => void
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

export const ScrollViewHeader = ({ actionSize = 48, actionStyle, backAction, backActionFixed, caption, centerContent, children, iconSize, style, title, topInset = true, trailingAction, trailingActionFixed = true }: ScrollViewHeaderProps) => {
  const { blur, headerHeight, headerFixed, headerOffset, progress, progressing, pullSearchHeightShared, scrollPosition, setHeaderHeight, snapBackHeaderShared } = useContext(ScrollViewContext)
  const { settings } = useContext(ScrollViewSettingsContext)
  const effectiveBackActionFixed = backActionFixed ?? settings.backActionFixed
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const top = topInset ? insets.top : 0
  const handleLayout = ({
    nativeEvent: {
      layout: { height }
    }
  }: LayoutChangeEvent) => {
    if (headerHeight !== height) setHeaderHeight(height)
  }
  const translateStyle = useAnimatedStyle(() => {
    if (headerFixed) return { transform: [{ translateY: 0 }] }
    if (snapBackHeaderShared.value) return { transform: [{ translateY: headerOffset.value }] }
    const effective = scrollPosition.value + (headerHeight ?? 0) - pullSearchHeightShared.value
    if (effective <= 0) return { transform: [{ translateY: 0 }] }
    return { transform: [{ translateY: -effective }] }
  }, [headerFixed, headerHeight])
  const blurStyle = useAnimatedStyle(() => {
    if (!headerHeight) return { height: 0 }
    if (headerFixed) return { height: headerHeight }
    const h = headerHeight ?? 0
    const translateY = snapBackHeaderShared.value ? headerOffset.value : -Math.max(0, scrollPosition.value + h - pullSearchHeightShared.value)
    return { height: Math.max(h + translateY, top) }
  }, [headerFixed, headerHeight, top])
  const progressStyle = useAnimatedStyle(() => {
    const h = headerHeight ?? 0
    if (headerFixed) return { top: h }
    const slide = snapBackHeaderShared.value ? -headerOffset.value : Math.max(0, scrollPosition.value + h - pullSearchHeightShared.value)
    return { top: Math.max(h - slide, top) }
  }, [headerFixed, headerHeight, top])
  const actionMargin = 4
  const contentMinHeight = actionSize + 2 * actionMargin
  const actionTop = top + actionMargin
  const buttonStyle = { borderRadius: actionSize, height: actionSize, margin: 0, width: actionSize }
  const actionShadow = { borderRadius: actionSize / 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
  const leadingStyle = { alignItems: 'center' as const, height: actionSize, justifyContent: 'center' as const, left: actionMargin, position: 'absolute' as const, top: actionTop, width: actionSize, zIndex: 3, ...actionShadow }
  const trailingStyle = { alignItems: 'center' as const, height: actionSize, justifyContent: 'center' as const, position: 'absolute' as const, right: actionMargin, top: actionTop, width: actionSize, zIndex: 3, ...actionShadow }
  return (
    <>
      <Animated.View pointerEvents='none' style={[styles.blur, blurStyle]}>
        {headerHeight !== null && headerHeight > 0 && <BlurView blur={blur} style={[styles.blurInner, { height: headerHeight }]} />}
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
            <Appbar.BackAction onPress={backAction} size={iconSize ?? actionSize / 2} style={buttonStyle} />
          </Animated.View>
        ) : (
          <Animated.View style={[leadingStyle, translateStyle]}>
            <ActionBg blur={blur} style={actionStyle} />
            <Appbar.BackAction onPress={backAction} size={iconSize ?? actionSize / 2} style={buttonStyle} />
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
