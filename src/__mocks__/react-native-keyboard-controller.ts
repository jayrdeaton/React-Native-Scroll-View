import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const KeyboardAwareScrollView = stub
export const KeyboardAwareFlatList = stub
export const useKeyboardHandler = jest.fn()
export const useReanimatedKeyboardAnimation = () => ({
  height: { value: 0 },
  progress: { value: 0 }
})
