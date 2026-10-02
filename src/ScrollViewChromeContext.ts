import { createContext } from 'react'
import type { SharedValue } from 'react-native-reanimated'

// Two contexts, deliberately split by who is allowed to see them:
//
// ScrollViewChromeHostContext is the claim machinery. ScrollViewProvider reads it to decide whether
// it is "hosted" and then immediately re-provides `null` around its own children, so a nested
// ScrollViewProvider (a picker or form modal rendered inside a screen) never sees the host and never
// competes with its parent screen for it.
//
// ScrollViewChromeContext is the public, never-cleared face of the same host: the shared offset a
// persistent bar animates from, plus pin/reveal controls. It has to survive the clearing above
// because the components that use it (a search bar, a pager) sit *below* a ScrollViewProvider.
export type ScrollViewChromeHost = {
  activeId: string | null
  claim: (id: string) => void
  footprint: number
  offset: SharedValue<number>
  overhang: number
  pinned: boolean
  release: (id: string) => void
  reveal: () => void
  snapBack: boolean
  useIsActive: () => boolean
}

export type ScrollViewChrome = {
  addPin: () => void
  footprint: number
  offset: SharedValue<number>
  overhang: number
  removePin: () => void
  reveal: () => void
}

export const ScrollViewChromeHostContext = createContext<ScrollViewChromeHost | null>(null)
export const ScrollViewChromeContext = createContext<ScrollViewChrome | null>(null)
