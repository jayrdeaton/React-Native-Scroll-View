import { RefreshControl as RNRefreshControl, type RefreshControlProps } from 'react-native'

export type { RefreshControlProps }

export const RefreshControl = (props: Partial<RefreshControlProps>) => <RNRefreshControl refreshing={false} {...props} />
