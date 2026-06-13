import { BlurView } from '@rific/auto-paper'
import { useContext } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ScrollViewContext } from '../ScrollViewContext'

const DOT_FULL = 8
const DOT_SMALL = 3
const DOT_GAP = 6
const DOT_STEP = DOT_FULL + DOT_GAP
const CLIP_COUNT = 5
const CLIP_WIDTH = CLIP_COUNT * DOT_STEP - DOT_GAP
const PILL_PAD_H = 10
const PILL_PAD_V = 6
const PILL_HEIGHT = DOT_FULL + PILL_PAD_V * 2
const PILL_RADIUS = PILL_HEIGHT / 2
const PILL_WIDTH = CLIP_WIDTH + PILL_PAD_H * 2

type DotProps = {
  activeColor: string
  index: number
  inactiveColor: string
  pageWidth: number
  scrollPosition: SharedValue<number>
}

const Dot = ({ activeColor, index, inactiveColor, pageWidth, scrollPosition }: DotProps) => {
  const circleStyle = useAnimatedStyle(() => {
    const page = scrollPosition.value / pageWidth
    const distance = Math.abs(index - page)
    const t = Math.max(0, Math.min((distance - 0.5) / 2, 1))
    const size = DOT_FULL + (DOT_SMALL - DOT_FULL) * t
    const backgroundColor = interpolateColor(t, [0, 1], [activeColor, inactiveColor])
    return { backgroundColor, borderRadius: size / 2, height: size, width: size }
  })
  return (
    <View style={styles.dotContainer}>
      <Animated.View style={circleStyle} />
    </View>
  )
}

type Props = { total: number }

export const HorizontalDots = ({ total }: Props) => {
  const { blur, footerHeightShared, scrollPosition } = useContext(ScrollViewContext)
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const insetsBottom = insets.bottom

  const activeColor = theme.colors.primary
  const inactiveColor = theme.colors.outlineVariant

  const pillContainerStyle = useAnimatedStyle(() => ({
    bottom: Math.max(footerHeightShared.value, insetsBottom) + 8
  }))

  const rowStyle = useAnimatedStyle(() => {
    const page = scrollPosition.value / width
    const maxOffset = Math.max(0, (total - CLIP_COUNT) * DOT_STEP)
    const offset = Math.max(0, Math.min((page - (CLIP_COUNT - 1) / 2) * DOT_STEP, maxOffset))
    return { transform: [{ translateX: -offset }] }
  })

  return (
    <Animated.View pointerEvents='none' style={[styles.pillContainer, pillContainerStyle]}>
      <View style={styles.pill}>
        <BlurView blur={blur} style={StyleSheet.absoluteFill} />
        <View style={styles.dotsClip}>
          <Animated.View style={[styles.dotsRow, rowStyle]}>
            {Array.from({ length: total }).map((_, i) => (
              <Dot key={i} activeColor={activeColor} index={i} inactiveColor={inactiveColor} pageWidth={width} scrollPosition={scrollPosition} />
            ))}
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  dotContainer: { alignItems: 'center', height: DOT_FULL, justifyContent: 'center', width: DOT_FULL },
  dotsClip: { overflow: 'hidden', width: CLIP_WIDTH },
  dotsRow: { flexDirection: 'row', gap: DOT_GAP },
  pill: {
    alignItems: 'center',
    borderRadius: PILL_RADIUS,
    height: PILL_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    width: PILL_WIDTH
  },
  pillContainer: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 }
})
