import { createContext, type RefObject } from 'react'
import { SharedValue } from 'react-native-reanimated'

export type ScrollViewContextType = {
  blur: boolean
  // True when this provider is driven by a ScrollViewChromeProvider above the navigator (see
  // ScrollViewChromeProvider). Hosted footers sit above the persistent bar, share its offset, and
  // always snap back.
  chromeHosted: boolean
  chromeOverhang: number
  // Whether this provider's scroll handlers may currently write footerOffset: always true unhosted,
  // and only while this provider owns the host (and nothing has pinned it) when hosted.
  chromeWritable: SharedValue<boolean>
  footerAboveKeyboard: boolean
  footerHeight: number | null
  footerHeightShared: SharedValue<number>
  footerFixed: boolean
  footerOffset: SharedValue<number>
  headerHeight: number | null
  headerHeightShared: SharedValue<number>
  headerFixed: boolean
  headerOffset: SharedValue<number>
  // Plain (non-Reanimated) counter for JS-thread-only scroll handlers (FlatList's useScrollHandlerJS).
  // A SharedValue is deliberately NOT used here: mutating `.value` from inside a React commit-phase
  // callback (a layout effect) is not synchronously visible even to an immediate subsequent read in
  // the same callback — Reanimated defers the actual flush — which silently broke the "did another
  // list instance just unmount" check this counter exists for. A plain ref has no such batching.
  jsListGeneration: RefObject<number>
  listGeneration: SharedValue<number>
  onJsListUnmount: () => void
  onListUnmount: () => void
  progress: number | null
  pullSearchHeightShared: SharedValue<number>
  snapBackFooterShared: SharedValue<boolean>
  snapBackHeaderShared: SharedValue<boolean>
  progressing: boolean
  scrollHeight: number
  scrollPosition: SharedValue<number>
  setFooterHeight: (h: number | null) => void
  setHeaderHeight: (h: number | null) => void
  setProgress: (p: number | null) => void
  setProgressing: (b: boolean) => void
  // The farthest footerOffset can travel: how far the whole bottom stack has to slide to clear the
  // screen. Unhosted this IS footerHeightShared (the same SharedValue), so unhosted snap-back
  // clamps exactly as it always has.
  stackHeightShared: SharedValue<number>
  tabBarHeight: number
}

export const ScrollViewContext = createContext<ScrollViewContextType>({
  blur: true,
  chromeHosted: false,
  chromeOverhang: 0,
  chromeWritable: null as unknown as SharedValue<boolean>,
  footerAboveKeyboard: false,
  footerHeight: null,
  footerHeightShared: null as unknown as SharedValue<number>,
  footerFixed: false,
  footerOffset: null as unknown as SharedValue<number>,
  headerHeight: null,
  headerHeightShared: null as unknown as SharedValue<number>,
  headerFixed: false,
  headerOffset: null as unknown as SharedValue<number>,
  jsListGeneration: { current: 0 },
  listGeneration: null as unknown as SharedValue<number>,
  onJsListUnmount: () => {},
  onListUnmount: () => {},
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
  stackHeightShared: null as unknown as SharedValue<number>,
  tabBarHeight: 0
})
