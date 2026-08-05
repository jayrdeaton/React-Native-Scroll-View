import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const ProgressBar = jest.fn(() => null)
export const Surface = jest.fn(stub)
export const Chip = jest.fn(stub)

// Forwards a fresh spy-able {blur, focus} stub to whatever ref the consumer passes (PullSearch's
// own inputRef), instead of dropping it — the real Searchbar forwards to a native TextInput the
// same way. Exported so a test can grab the SAME instance a given render produced, via
// `getLastSearchbarRef()`, to assert PullSearch's internal `blurInput()` (fired from its
// useAnimatedReaction) actually called .blur() on it — otherwise unobservable, since PullSearch
// never exposes inputRef itself.
let lastSearchbarRef: { blur: jest.Mock; focus: jest.Mock } | null = null
export const getLastSearchbarRef = () => lastSearchbarRef
export const Searchbar = React.forwardRef<{ blur: () => void; focus: () => void }, Record<string, unknown>>((_props, ref) => {
  const stubRef = React.useRef({ blur: jest.fn(), focus: jest.fn() })
  lastSearchbarRef = stubRef.current
  React.useImperativeHandle(ref, () => stubRef.current)
  return null
})

const BackAction = jest.fn(() => null)
export const Appbar = { BackAction }

export const useTheme = () => ({
  dark: false,
  colors: {
    primary: '#6200ee',
    surface: '#ffffff',
    onSurface: '#000000',
    onSurfaceVariant: '#49454f',
    outlineVariant: '#cac4d0'
  }
})
