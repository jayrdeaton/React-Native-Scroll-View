import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const BlurView = jest.fn(stub)
export const FAB = jest.fn(stub)
export const usePaperDefaults = () => ({ FAB: {} })
