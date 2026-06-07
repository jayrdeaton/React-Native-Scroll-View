import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const GestureDetector = stub
export const Gesture = {
  Native: jest.fn(() => ({})),
  Simultaneous: jest.fn((...gestures: unknown[]) => gestures[0])
}
export type GestureType = object
