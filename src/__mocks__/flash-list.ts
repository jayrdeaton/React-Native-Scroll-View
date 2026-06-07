import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

// Minimal type surface so ts-jest can resolve FlashListProps without the real package
export type FlashListProps<T> = {
  data?: readonly T[] | null
  estimatedItemSize?: number
  renderItem?: ((info: { item: T; index: number }) => React.ReactElement | null) | null
  contentInset?: { top?: number; bottom?: number; left?: number; right?: number }
  contentOffset?: { x: number; y: number }
  onRefresh?: (() => void) | null
  onScroll?: unknown
  refreshControl?: React.ReactElement | null
  refreshing?: boolean | null
  scrollEventThrottle?: number
  [key: string]: unknown
}

export const FlashList = jest.fn(stub)
