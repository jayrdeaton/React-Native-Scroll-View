import { RefreshControl as RNRefreshControl, type RefreshControlProps } from 'react-native'
import { useTheme } from 'react-native-paper'

export type { RefreshControlProps }

// React Native's RefreshControl in the Paper theme's colors. Without them Android draws its own default, a white disk
// with a black arrow, which glares over a dark app, and iOS a grey spinner; `tintColor` alone only reaches iOS.
// The arrow (Android) and spinner (iOS) take the theme's primary, and Android's disk the theme's level-3 elevation, a
// raised surface a step above cards (the plain surface when a theme has no elevation levels).
// A list with no onRefresh still gets a control, but Android's pull is off there (`enabled` is Android only), so a
// pull doesn't bring down a disk that spins and snaps back with nothing to refresh. Props passed in win over all of it.
export const RefreshControl = (props: Partial<RefreshControlProps>) => {
  const { colors } = useTheme()
  return <RNRefreshControl refreshing={false} enabled={!!props.onRefresh} colors={[colors.primary]} progressBackgroundColor={colors.elevation?.level3 ?? colors.surface} tintColor={colors.primary} {...props} />
}
