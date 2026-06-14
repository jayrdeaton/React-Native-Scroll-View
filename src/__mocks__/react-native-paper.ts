import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const ProgressBar = jest.fn(() => null)
export const Surface = jest.fn(stub)
export const Chip = jest.fn(stub)
export const Searchbar = jest.fn(() => null)

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
