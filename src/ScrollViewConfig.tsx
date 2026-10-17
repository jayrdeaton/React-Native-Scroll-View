import { createModuleConfig } from '@rific/core'
import type { ComponentType, ReactNode } from 'react'
import type { ViewStyle } from 'react-native'

// What ScrollViewHeader passes the back action it renders for a plain `backAction` callback.
// react-native-paper's Appbar.BackAction (the default) takes these, and so does
// @rific/feedback-press's AppbarBackAction, which wraps it, so either drops in as is.
export type ScrollViewBackActionProps = {
  accessibilityLabel?: string
  onPress: () => void
  size: number
  style: ViewStyle
}

export type ScrollViewConfig = {
  /** Component ScrollViewHeader renders when `backAction` is a plain callback. Pass `AppbarBackAction` from `@rific/feedback-press` to give every header's back button its haptics and sound; omit to keep react-native-paper's `Appbar.BackAction`. A `backAction` element on one header still replaces it there. */
  BackAction?: ComponentType<ScrollViewBackActionProps>
}

// @rific/core's createModuleConfig() supplies the module-level config singleton (configure/
// getConfig/Provider) every @rific package wires up the same way - see its own doc comment for
// why this is plain module state rather than React Context. It injects a component instead of
// depending on @rific/feedback-press, same as @rific/resizable-input's TextInputComponent.
//
// Not to be confused with ScrollViewProvider (per screen, scroll state) or
// ScrollViewSettingsProvider (app-wide, persisted user settings): this one is app-wide startup
// config, mounted once.
const scrollViewConfig = createModuleConfig<ScrollViewConfig>()

export const configureScrollView = scrollViewConfig.configure
export const getScrollViewConfig = scrollViewConfig.getConfig
export const ScrollViewConfigProvider = scrollViewConfig.Provider

export type ScrollViewConfigProviderProps = ScrollViewConfig & { children: ReactNode }
