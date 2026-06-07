import { FAB as AutoPaperFAB } from '@rific/auto-paper'
import { FABProps } from 'react-native-paper'

type InternalFABProps = Pick<FABProps, 'icon' | 'onPress' | 'style'>

export const FAB = (props: InternalFABProps) => <AutoPaperFAB animated={false} label='' size='small' {...props} />
