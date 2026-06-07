import { BlurView } from './internal/BlurView'
import { type ReactNode, useContext } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native'
import { ProgressBar } from 'react-native-paper'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'

export type ScrollViewHeaderProps = {
  children?: ReactNode | ReactNode[]
  style?: ViewStyle
  topInset?: boolean
}

export const ScrollViewHeader = ({ children, style, topInset = true }: ScrollViewHeaderProps) => {
  const { blur, headerHeight, headerLock, progress, progressing, scrollPosition, setHeaderHeight } = useContext(ScrollViewContext)
  const insets = useSafeAreaInsets()
  const top = topInset ? insets.top : 0
  const handleLayout = ({ nativeEvent: { layout: { height } } }: LayoutChangeEvent) => {
    if (headerHeight !== height) setHeaderHeight(height)
  }
  const blurStyle = useAnimatedStyle(() => {
    if (headerLock || scrollPosition.value < 0) return { transform: [{ translateY: 0 }] }
    const minimumY = headerHeight - top
    const translateY = scrollPosition.value > minimumY ? -minimumY : -scrollPosition.value
    return { transform: [{ translateY }] }
  }, [headerHeight, headerLock, top])
  const headerStyle = useAnimatedStyle(() => {
    if (headerLock || scrollPosition.value < 0) return { transform: [{ translateY: 0 }] }
    const translateY = scrollPosition.value < 0 ? 0 : -scrollPosition.value
    return { transform: [{ translateY }] }
  }, [headerLock])
  const progressStyle = useAnimatedStyle(() => {
    if (headerLock || scrollPosition.value < 0) return { transform: [{ translateY: 0 }] }
    const minimumY = headerHeight - top - 4
    const translateY = scrollPosition.value > minimumY ? -minimumY : -scrollPosition.value
    return { transform: [{ translateY }] }
  }, [headerHeight, headerLock, top])
  return (
    <View onLayout={handleLayout} pointerEvents='box-none' style={styles.header}>
      {!headerLock && top > 0 && <BlurView blur={blur} style={[styles.blur, { height: top }]} />}
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]}>
        <BlurView blur={blur} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[{ paddingTop: top }, style, headerStyle]}>
        <View style={styles.row}>{children}</View>
      </Animated.View>
      <Animated.View style={progressStyle}>
        <ProgressBar indeterminate={progress === null} visible={progressing} progress={progress ?? undefined} style={styles.progress} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  blur: { position: 'absolute', width: '100%', zIndex: 2 },
  header: { zIndex: 1 },
  progress: { height: 4, marginBottom: -4 },
  row: { alignItems: 'center', flexDirection: 'row', zIndex: 1 }
})
