import { BlurView } from '@rific/auto-paper'
import { type ReactNode, useContext, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native'
import { ProgressBar } from 'react-native-paper'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'

export type ScrollViewFooterProps = {
  children?: ReactNode | ReactNode[]
  style?: ViewStyle
}

export const ScrollViewFooter = ({ children, style }: ScrollViewFooterProps) => {
  const { blur, footerHeight, footerLock, progress, progressing, scrollPosition, setFooterHeight } = useContext(ScrollViewContext)
  const insets = useSafeAreaInsets()
  useEffect(
    () => () => {
      setFooterHeight(0)
    },
    [setFooterHeight]
  )
  const handleLayout = ({ nativeEvent: { layout: { height } } }: LayoutChangeEvent) => {
    if (footerHeight !== height) setFooterHeight(height)
  }
  const blurStyle = useAnimatedStyle(() => {
    if (footerLock || scrollPosition.value < 0) return { transform: [{ translateY: 0 }] }
    const maximumY = footerHeight - insets.bottom
    const translateY = scrollPosition.value > maximumY ? maximumY : scrollPosition.value
    return { transform: [{ translateY }] }
  }, [footerHeight, footerLock, insets.bottom])
  const footerStyle = useAnimatedStyle(() => {
    if (footerLock || scrollPosition.value < 0) return { transform: [{ translateY: 0 }] }
    const translateY = scrollPosition.value > footerHeight ? footerHeight : scrollPosition.value
    return { transform: [{ translateY }] }
  }, [footerHeight, footerLock])
  const progressStyle = useAnimatedStyle(() => {
    if (footerLock || scrollPosition.value < 0) return { transform: [{ translateY: 0 }] }
    const maximumY = footerHeight - insets.bottom - 4
    const translateY = scrollPosition.value > maximumY ? maximumY : scrollPosition.value
    return { transform: [{ translateY }] }
  }, [footerHeight, footerLock, insets.bottom])
  return (
    <View onLayout={handleLayout} pointerEvents='box-none' style={styles.footer}>
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]}>
        <BlurView blur={blur} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={progressStyle}>
        <ProgressBar indeterminate={progress === null} visible={progressing} progress={progress ?? undefined} style={styles.progress} />
      </Animated.View>
      <Animated.View style={[styles.row, { paddingBottom: insets.bottom }, style, footerStyle]}>{children}</Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { bottom: 0, left: 0, position: 'absolute', right: 0, zIndex: 2 },
  progress: { height: 4, marginTop: -4 },
  row: { alignItems: 'center', flexDirection: 'row', zIndex: 1 }
})
