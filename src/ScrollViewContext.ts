import { createContext } from 'react'
import { SharedValue } from 'react-native-reanimated'

export type ScrollViewContextType = {
  blur: boolean
  footerHeight: number
  footerHeightShared: SharedValue<number>
  footerFixed: boolean
  footerOffset: SharedValue<number>
  headerHeight: number
  headerHeightShared: SharedValue<number>
  headerFixed: boolean
  headerOffset: SharedValue<number>
  progress: number | null
  pullSearchHeightShared: SharedValue<number>
  snapBackFooterShared: SharedValue<boolean>
  snapBackHeaderShared: SharedValue<boolean>
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
  footerHeightShared: null as unknown as SharedValue<number>,
  footerFixed: false,
  footerOffset: null as unknown as SharedValue<number>,
  headerHeight: 0,
  headerHeightShared: null as unknown as SharedValue<number>,
  headerFixed: false,
  headerOffset: null as unknown as SharedValue<number>,
  progress: null,
  progressing: false,
  pullSearchHeightShared: null as unknown as SharedValue<number>,
  scrollHeight: 0,
  scrollPosition: null as unknown as SharedValue<number>,
  setFooterHeight: () => {},
  setHeaderHeight: () => {},
  setProgress: () => {},
  setProgressing: () => {},
  snapBackFooterShared: null as unknown as SharedValue<boolean>,
  snapBackHeaderShared: null as unknown as SharedValue<boolean>,
  tabBarHeight: 60
})
