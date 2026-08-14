import { Chip, type ChipProps as AutoPaperChipProps } from '@rific/auto-paper'
import { type ReactNode } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { Icon, useTheme } from 'react-native-paper'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

// 'children' omitted alongside the rest — this chip's own text always comes from `label` (or the
// isHorizontal-driven 'Start'/'Top' default below), passed as the real JSX children the underlying
// Chip renders with, which is what actually wins: React always takes the children an element is
// given between its tags over one merely passed as a "children" prop via spread. A `children` in
// chipProps would therefore type-check but silently do nothing at runtime — omitting it here means
// TypeScript catches that mismatch instead of a caller finding out the hard way.
export type ChipProps = Omit<AutoPaperChipProps, 'compact' | 'icon' | 'onPress' | 'children'> & {
  label?: ReactNode
}

type Props = {
  chipProps?: ChipProps
  isHorizontal?: boolean
  onChipPress?: () => void
  onPress: () => void
  style: AnimatedStyle<ViewStyle>
}

export const ScrollViewChip = ({ chipProps, isHorizontal, onChipPress, onPress, style }: Props) => {
  const { colors } = useTheme()
  const { label, selectedColor, style: chipStyle, ...restChipProps } = (chipProps ?? {}) as Partial<ChipProps>
  const handlePress = onChipPress
    ? () => {
        onPress()
        onChipPress()
      }
    : onPress
  // Rendered via `avatar`, not Chip's own `icon` prop: react-native-paper's MD3 Chip hardcodes
  // `icon`'s color to theme.colors.primary and ignores `selectedColor` entirely (its own doc
  // comment: "With theme version 3 selectedColor doesn't apply to the icon. If you want [a]
  // custom color for the icon, render your own Icon component") — a chip whose own background
  // IS theme.colors.primary (this library's callers all set that; see Hangman's own vivid-chip
  // convention) renders that icon invisible against itself. `avatar` has no such override; it
  // clones whatever element/color it's given. Falls back to the same default Paper itself would
  // resolve for unselected/non-outlined text (onSecondaryContainer) or outlined text
  // (onSurfaceVariant), so the icon still matches the label color when no selectedColor is set.
  const iconColor = selectedColor ?? (restChipProps.mode === 'outlined' ? colors.onSurfaceVariant : colors.onSecondaryContainer)
  return (
    <Animated.View style={[styles.chip, style]}>
      <Chip compact selectedColor={selectedColor} {...restChipProps} avatar={<Icon source={isHorizontal ? 'chevron-left' : 'chevron-up'} size={18} color={iconColor} />} onPress={handlePress} style={[styles.chipInner, chipStyle]}>
        {label ?? (isHorizontal ? 'Start' : 'Top')}
      </Chip>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 },
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
})
