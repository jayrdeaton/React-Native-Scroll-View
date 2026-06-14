import { StyleSheet, type ViewStyle } from 'react-native'
import { Chip } from 'react-native-paper'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

type Props = {
  isHorizontal?: boolean
  onPress: () => void
  style: AnimatedStyle<ViewStyle>
}

export const ScrollViewChip = ({ isHorizontal, onPress, style }: Props) => (
  <Animated.View style={[styles.chip, style]}>
    <Chip compact icon={isHorizontal ? 'chevron-left' : 'chevron-up'} onPress={onPress} style={styles.chipInner}>
      {isHorizontal ? 'Start' : 'Top'}
    </Chip>
  </Animated.View>
)

const styles = StyleSheet.create({
  chip: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 },
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
})
