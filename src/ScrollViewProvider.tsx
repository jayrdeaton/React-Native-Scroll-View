import { type ReactNode, useMemo, useState } from 'react'
import { Dimensions } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { ScrollViewContext } from './ScrollViewContext'

export type ScrollViewProviderProps = {
  blur?: boolean
  children: ReactNode
  footerLock?: boolean
  headerLock?: boolean
  tabBarHeight?: number
}

export const ScrollViewProvider = ({ blur = true, children, footerLock = false, headerLock = false, tabBarHeight = 60 }: ScrollViewProviderProps) => {
  const [headerHeight, setHeaderHeight] = useState(0)
  const [footerHeight, setFooterHeight] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressing, setProgressing] = useState(false)
  const scrollPosition = useSharedValue(0)
  const scrollHeight = useMemo(() => Dimensions.get('window').height - headerHeight - footerHeight, [headerHeight, footerHeight])
  const value = useMemo(
    () => ({ blur, footerHeight, footerLock, headerHeight, headerLock, progress, progressing, scrollHeight, scrollPosition, setFooterHeight, setHeaderHeight, setProgress, setProgressing, tabBarHeight }),
    [blur, footerHeight, footerLock, headerHeight, headerLock, progress, progressing, scrollHeight, scrollPosition, tabBarHeight]
  )
  return <ScrollViewContext.Provider value={value}>{children}</ScrollViewContext.Provider>
}
