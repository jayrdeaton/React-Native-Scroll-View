import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

const StyleSheet = {
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  create: <T extends object>(styles: T): T => styles,
  flatten: (style: unknown) => style
}

const Dimensions = {
  get: (_dim: string) => ({ width: 390, height: 844 })
}

const Platform = {
  OS: 'ios' as 'ios' | 'android',
  select: (obj: Record<string, unknown>) => obj[Platform.OS] ?? obj.default
}

export { Dimensions, Platform, StyleSheet }

export const View = stub
export const Text = stub
export const Pressable = stub
export const TouchableOpacity = stub
export const FlatList = jest.fn(stub)
export const RefreshControl = jest.fn(stub)
export const SectionList = jest.fn(stub)
export const ScrollView = jest.fn(stub)
export const useWindowDimensions = () => ({ width: 390, height: 844, fontScale: 1, scale: 1 })
