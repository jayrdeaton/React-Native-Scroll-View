import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, type TextInput } from 'react-native'
import { Searchbar, useTheme } from 'react-native-paper'
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'

import { ScrollViewContext } from './ScrollViewContext'

export type PullSearchHandle = {
  blur: () => void
  focus: () => void
}

export type PullSearchProps = {
  debounce?: boolean
  onChangeText: (text: string) => void
  onHeightChange: (height: number) => void
  placeholder?: string
  value?: string
}

export const PullSearch = forwardRef<PullSearchHandle, PullSearchProps>(function PullSearch({ debounce, onChangeText, onHeightChange, placeholder, value: propValue }, ref) {
  const { headerHeight, scrollPosition } = useContext(ScrollViewContext)
  const theme = useTheme()
  const inputRef = useRef<TextInput>(null)
  const [barHeight, setBarHeight] = useState(0)
  const [value, setValue] = useState(propValue ?? '')
  const prevPropValueRef = useRef<string | undefined>(propValue)

  useEffect(() => {
    if (prevPropValueRef.current === propValue) return
    prevPropValueRef.current = propValue
    setValue(propValue ?? '')
  }, [propValue])

  useImperativeHandle(ref, () => ({
    blur: () => inputRef.current?.blur(),
    focus: () => inputRef.current?.focus()
  }))

  const blurInput = useCallback(() => inputRef.current?.blur(), [])

  useAnimatedReaction(
    () => {
      if (barHeight === 0) return false
      return scrollPosition.value >= -(headerHeight ?? 0) + barHeight
    },
    (isHidden, wasHidden) => {
      if (isHidden && !wasHidden) runOnJS(blurInput)()
    },
    [barHeight, headerHeight, blurInput]
  )

  const handleClear = useCallback(() => {
    setValue('')
    onChangeText('')
  }, [onChangeText])

  const handleLayout = useCallback(
    ({
      nativeEvent: {
        layout: { height }
      }
    }: LayoutChangeEvent) => {
      setBarHeight(height)
      onHeightChange(height)
    },
    [onHeightChange]
  )

  useEffect(() => {
    const normalizedValue = value.trim()
    if (debounce) {
      const timeout = setTimeout(() => onChangeText(normalizedValue), 500)
      return () => clearTimeout(timeout)
    }
    onChangeText(normalizedValue)
  }, [debounce, onChangeText, value])

  // Fade out as the bar scrolls up into the header blur region.
  // showY = -headerHeight: natural rest, bar fully visible just below header.
  // hideY = -headerHeight + barHeight: bar scrolled behind header, opacity 0.
  const animatedStyle = useAnimatedStyle(() => {
    if (barHeight === 0) return { opacity: 0 }
    const h = headerHeight ?? 0
    const showY = -h
    const hideY = -h + barHeight
    return { opacity: interpolate(scrollPosition.value, [showY, hideY], [1, 0], Extrapolation.CLAMP) }
  }, [barHeight, headerHeight])

  return (
    <Animated.View onLayout={handleLayout} style={[styles.container, animatedStyle]}>
      <Searchbar autoCorrect={false} onChangeText={(text) => setValue((text || '').trimStart())} onClearIconPress={handleClear} placeholder={placeholder} placeholderTextColor={theme.colors.onSurfaceVariant} ref={inputRef} spellCheck={false} style={styles.input} value={value} />
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  input: { margin: 0 }
})
