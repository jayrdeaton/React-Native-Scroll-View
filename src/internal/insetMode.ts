import { Platform } from 'react-native'

// iOS positions content under the translucent bars with contentInset/contentOffset. Android and
// react-native-web silently ignore both, so on those platforms the same geometry is emulated with
// content-container padding, and the scroll handlers normalize offsets back into inset space
// (rest position = -headerHeight) so every downstream calculation keeps one coordinate system.
// Pull-search relies on iOS overscroll physics and stays disabled outside inset mode.
export const usesContentInset = Platform.OS === 'ios'
