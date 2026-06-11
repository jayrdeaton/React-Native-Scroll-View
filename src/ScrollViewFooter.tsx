import { BlurView } from '@rific/auto-paper'
import { type ReactNode, useContext, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from './ScrollViewContext'

export type ScrollViewFooterProps = {
  children?: ReactNode | ReactNode[]
  style?: ViewStyle
}

export const ScrollViewFooter = ({ children, style }: ScrollViewFooterProps) => {
  const { blur, footerHeight, footerFixed, footerOffset, headerHeightShared, pullSearchHeightShared, scrollPosition, setFooterHeight, snapBackFooterShared } = useContext(ScrollViewContext)
  const insets = useSafeAreaInsets()
  useEffect(
    () => () => {
      setFooterHeight(0)
    },
    [setFooterHeight]
  )
  const handleLayout = ({
    nativeEvent: {
      layout: { height }
    }
  }: LayoutChangeEvent) => {
    if (footerHeight !== height) setFooterHeight(height)
  }
  const footerStyle = useAnimatedStyle(() => {
    if (footerFixed) return { transform: [{ translateY: 0 }] }
    if (snapBackFooterShared.value) return { transform: [{ translateY: footerOffset.value }] }
    const effective = scrollPosition.value + headerHeightShared.value - pullSearchHeightShared.value
    if (effective <= 0) return { transform: [{ translateY: 0 }] }
    return { transform: [{ translateY: Math.min(effective, footerHeight) }] }
  }, [footerHeight, footerFixed])
  return (
    <Animated.View onLayout={handleLayout} pointerEvents='box-none' style={[styles.footer, footerStyle]}>
      {footerHeight > 0 && <BlurView blur={blur} style={StyleSheet.absoluteFill} />}
      <View style={[styles.row, { paddingBottom: insets.bottom }, style]}>{children}</View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  footer: { bottom: 0, left: 0, position: 'absolute', right: 0, zIndex: 2 },
  row: { alignItems: 'center', flexDirection: 'row', zIndex: 1 }
})
