import { StyleSheet } from 'react-native'
import { Chip } from 'react-native-paper'
import Animated from 'react-native-reanimated'

type Props = {
  animatedProps: any
  onPress: () => void
  style: any
}

export const ScrollViewChip = ({ animatedProps, onPress, style }: Props) => (
  <Animated.View animatedProps={animatedProps} style={[styles.chip, style]}>
    <Chip compact icon='chevron-up' onPress={onPress} style={styles.chipInner}>
      Top
    </Chip>
  </Animated.View>
)

const styles = StyleSheet.create({
  chip: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 3 },
  chipInner: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }
})
