import { BlurView as ExpoBlurView } from 'expo-blur'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import { useTheme } from 'react-native-paper'

type BlurViewProps = {
  blur?: boolean
  style?: StyleProp<ViewStyle>
}

export const BlurView = ({ blur = true, style }: BlurViewProps) => {
  const { dark, colors } = useTheme()
  if (blur) return <ExpoBlurView tint={dark ? 'dark' : 'light'} style={style} />
  return <View style={[{ backgroundColor: colors.surface }, style]} />
}
