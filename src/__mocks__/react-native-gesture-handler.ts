import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const GestureDetector = stub
export const useNativeGesture = jest.fn(() => ({}))
export const useSimultaneousGestures = jest.fn((...gestures: unknown[]) => gestures[0])
export const Gesture = {
  Native: () => ({}),
  Simultaneous: (..._gestures: unknown[]) => ({})
}
export type GestureType = object
export type SingleGesture = object
