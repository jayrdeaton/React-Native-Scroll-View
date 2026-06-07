import { createContext } from 'react'
import { SharedValue } from 'react-native-reanimated'

export type ScrollViewContextType = {
  blur: boolean
  footerHeight: number
  footerLock: boolean
  headerHeight: number
  headerLock: boolean
  progress: number | null
  progressing: boolean
  scrollHeight: number
  scrollPosition: SharedValue<number>
  setFooterHeight: (h: number) => void
  setHeaderHeight: (h: number) => void
  setProgress: (p: number | null) => void
  setProgressing: (b: boolean) => void
  tabBarHeight: number
}

export const ScrollViewContext = createContext<ScrollViewContextType>({
  blur: true,
  footerHeight: 0,
  footerLock: false,
  headerHeight: 0,
  headerLock: false,
  progress: null,
  progressing: false,
  scrollHeight: 0,
  scrollPosition: null as unknown as SharedValue<number>,
  setFooterHeight: () => {},
  setHeaderHeight: () => {},
  setProgress: () => {},
  setProgressing: () => {},
  tabBarHeight: 60
})
