import { Chip, type ChipProps as AutoPaperChipProps } from '@rific/auto-paper'
import { type ReactNode } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

export type ChipProps = Omit<AutoPaperChipProps, 'compact' | 'icon' | 'onPress'> & {
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
  const { label, style: chipStyle, ...restChipProps } = (chipProps ?? {}) as Partial<ChipProps>
  const handlePress = onChipPress
    ? () => {
        onPress()
        onChipPress()
      }
    : onPress
  return (
    <Animated.View style={[styles.chip, style]}>
      <Chip compact {...restChipProps} icon={isHorizontal ? 'chevron-left' : 'chevron-up'} onPress={handlePress} style={[styles.chipInner, chipStyle]}>
        {label ?? (isHorizontal ? 'Start' : 'Top')}
      </Chip>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 },
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
})
