# @rific/scroll-view

Blur-chrome scroll system for React Native. Drop-in replacements for `ScrollView`, `FlatList`, and `SectionList` with floating headers and footers, pull-to-search, keyboard awareness, horizontal paging, and frosted-glass chrome.

## Installation

```sh
npm install @rific/scroll-view
```

### Peer dependencies

```sh
npm install @rific/auto-paper react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-paper react-native-keyboard-controller
```

The exported Redux slice has no dependency on `@reduxjs/toolkit` — it works with RTK stores, vanilla Redux, or no Redux at all.

## Quick start

Wrap your screen in `ScrollViewProvider`, add a `ScrollViewHeader`, then drop in one of the scroll components.

```tsx
import { ScrollViewProvider, ScrollViewHeader, FlatList } from '@rific/scroll-view'

export default function MyScreen() {
  return (
    <ScrollViewProvider>
      <ScrollViewHeader title="My Screen" backAction={() => router.back()} />
      <FlatList data={items} renderItem={({ item }) => <Row item={item} />} keyExtractor={(item) => item.id} />
    </ScrollViewProvider>
  )
}
```

For app-wide defaults, wrap your root layout with `ScrollViewSettingsProvider`.

```tsx
import { ScrollViewSettingsProvider } from '@rific/scroll-view'

export default function RootLayout({ children }) {
  return (
    <ScrollViewSettingsProvider initialValue={{ snapBack: true }}>
      {children}
    </ScrollViewSettingsProvider>
  )
}
```

---

## Components

### `ScrollViewSettingsProvider`

App-wide defaults for scroll settings. Wrap your root layout to set global defaults.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | — |
| `initialValue` | `Partial<ScrollViewSettings>` | Initial settings applied once on mount |
| `onChange` | `(settings: ScrollViewSettings) => void` | Called whenever settings change |

---

### `ScrollViewProvider`

Screen-level provider that owns header/footer state and scroll position. Must wrap `ScrollViewHeader`, `ScrollViewFooter`, and the scroll component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `blur` | `boolean` | system | Enable frosted-glass backdrop on header/footer |
| `chrome` | `boolean` | `true` | Join an enclosing [`ScrollViewChromeProvider`](#scrollviewchromeprovider) when there is one. Pass `false` to opt out — for a nested provider that isn't a screen, such as a picker or form modal. No effect when nothing hosts |
| `fixed` | `boolean` | `false` | Pin both header and footer (overrides `headerFixed`/`footerFixed`) |
| `footerAboveKeyboard` | `boolean` | `false` | With a fixed footer, float it above the keyboard instead of letting the keyboard cover it — see [Keyboard awareness](#keyboard-awareness) |
| `headerFixed` | `boolean` | `false` | Pin header; overrides settings default |
| `footerFixed` | `boolean` | `false` | Pin footer; overrides settings default |
| `snapBack` | `boolean` | `false` | Snap header and footer back when scrolling up |
| `snapBackHeader` | `boolean` | — | Override `snapBack` for header only |
| `snapBackFooter` | `boolean` | — | Override `snapBack` for footer only |
| `tabBarHeight` | `number` | `0` | Extra bottom inset reserved for a host app's own persistent tab bar (added on top of the safe-area inset, independent of any `ScrollViewFooter`). Ignored inside a `ScrollViewChromeProvider` — the host's `footprint` replaces it (see [Persistent bottom chrome](#persistent-bottom-chrome-hiding-a-tab-bar-with-scroll)) |

---

### `ScrollViewChromeProvider`

Hosts a persistent bottom bar (a tab bar) so it hides on scroll together with each screen's `ScrollViewFooter`. Mount it once, above the navigator. Every focused `ScrollViewProvider` below it joins automatically. See [Persistent bottom chrome](#persistent-bottom-chrome-hiding-a-tab-bar-with-scroll) for the full picture.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Usually the navigator (`<Tabs>`) |
| `footprint` | `number` | required | Height of the bar's resting box, including its bottom safe-area inset — how far above the screen bottom a hosted `ScrollViewFooter` has to sit to clear it. A plain number rather than something the bar reports back, so every screen has the right geometry on its very first render |
| `overhang` | `number` | `0` | How far the bar pokes *above* its resting box (a raised centre button, say). Hosted footers pad their bottom by this instead of the safe-area inset, and the hide distance covers it |
| `snapBack` | `boolean` | `true` | Hosted footers reveal on a short scroll-up instead of only near the top. A bar that hides on scroll has to be reachable from anywhere in a list, so leave this on unless you have a reason not to |
| `useIsActive` | `() => boolean` | `() => true` | A hook returning whether the calling screen is the focused one — pass react-navigation's `useIsFocused` (re-exported by `expo-router`). Only the focused screen drives the bar. Injected so this package carries no navigation dependency. **Must be a stable hook reference** (a module-level hook such as `useIsFocused`, never an inline arrow created per render): it is called as a hook on every render of every hosted provider |

The default `() => true` makes every mounted hosted screen claim the host, and the last one to mount owns it — only right for a navigator that keeps a single screen mounted. Use `useIsFocused` with `Tabs` or anything else that keeps visited screens alive.

---

### `ScrollViewHeader`

Floating header with blur backdrop, title, back action, trailing action, and built-in progress bar. Place it as a direct child of `ScrollViewProvider`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | — | Center title text |
| `caption` | `string` | — | Subtitle below title |
| `centerContent` | `ReactNode` | — | Replaces title/caption with custom content |
| `children` | `ReactNode` | — | Left-side content (icon buttons, etc.) |
| `backAction` | `() => void` | — | Renders a back button and calls this on press |
| `backActionFixed` | `boolean` | settings | Keep back button visible as header scrolls away |
| `trailingAction` | `ReactNode` | — | Right-side floating action |
| `trailingActionFixed` | `boolean` | `true` | Keep trailing action visible as header scrolls away |
| `actionSize` | `number` | `48` | Size of floating action buttons |
| `iconSize` | `number` | `actionSize/2` | Icon size inside action buttons |
| `actionStyle` | `ViewStyle` | — | Style applied to action button backgrounds |
| `style` | `ViewStyle` | — | Style applied to the header content area |
| `topInset` | `boolean` | `true` | Pad for safe area top inset |

---

### `ScrollViewFooter`

Floating footer with blur backdrop. Place it as a direct child of `ScrollViewProvider`.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Footer content |
| `style` | `ViewStyle` | Style applied to the inner row |

Inside a [`ScrollViewChromeProvider`](#scrollviewchromeprovider) the footer sits above the host's persistent bar and hides and reveals together with it.

---

### `ScrollView`

Drop-in for React Native's `ScrollView`. Accepts all `ScrollViewProps` plus:

| Prop | Type | Description |
|------|------|-------------|
| `chipProps` | `ChipProps` | Customize the scroll-to-top chip (label, style, etc.) |
| `chipThreshold` | `number` | Scroll offset (px) before the chip appears. Default `100` |
| `footerFixed` | `boolean` | Pin footer for this scroll view; overrides provider |
| `gesture` | `GestureType` | Compose with an external RNGH gesture |
| `headerFixed` | `boolean` | Pin header for this scroll view; overrides provider |
| `keyboardAware` | `boolean` | Add keyboard height to bottom content inset |
| `onChipPress` | `() => void` | Additional callback fired when the chip is pressed |
| `onRefresh` | `() => void` | Enables pull-to-refresh |
| `pullSearchHeight` | `number` | Reserve space above content for `PullSearch` |
| `ref` | `RefObject<RNScrollView>` | Forward ref to the underlying scroll view |
| `refreshing` | `boolean` | Controlled refreshing state |

---

### `FlatList`

Drop-in for React Native's `FlatList`. Accepts all `FlatListProps<T>` plus:

| Prop | Type | Description |
|------|------|-------------|
| `chipProps` | `ChipProps` | Customize the scroll-to-top/start chip (label, style, etc.) |
| `chipThreshold` | `number` | Scroll offset (px) before the chip appears. Default `100` |
| `footerFixed` | `boolean` | Pin footer for this list; overrides provider |
| `gesture` | `GestureType` | Compose with an external RNGH gesture |
| `headerFixed` | `boolean` | Pin header for this list; overrides provider |
| `keyboardAware` | `boolean` | Add keyboard height to bottom content inset |
| `onChipPress` | `() => void` | Additional callback fired when the chip is pressed |
| `onRefresh` | `() => Promise<void> \| void` | Enables pull-to-refresh |
| `pullSearchHeight` | `number` | Reserve space above content for `PullSearch` |
| `ref` | `RefObject<RNFlatList>` | Forward ref to the underlying list |
| `refreshing` | `boolean` | Controlled refreshing state |
| `renderFilters` | `ReactNode` | Rendered below `ListHeaderComponent`, above list items |

Performance props are user-overridable with sensible defaults:

| Prop | Default |
|------|---------|
| `initialNumToRender` | `20` |
| `maxToRenderPerBatch` | `50` |
| `windowSize` | `100` |
| `removeClippedSubviews` | `false` |
| `showsHorizontalScrollIndicator` | `horizontal` |
| `showsVerticalScrollIndicator` | `!horizontal` |

When `horizontal` and `pagingEnabled` are both true and `data` has more than one item, horizontal dot indicators render automatically.

---

### `SectionList`

Drop-in for React Native's `SectionList`. Accepts all `SectionListProps<ItemT, SectionT>` (except `horizontal`) plus the same set of library props as `FlatList`. Custom sticky section headers are supported — pass `renderSectionHeader` and `stickySectionHeadersEnabled` and the library renders them via an animated overlay so they properly account for the floating header offset.

---

### `CustomList`

Wraps any list component that follows the FlatList scroll API (e.g. FlashList). Pass the component via the `component` prop; all other props are forwarded.

```tsx
import { FlashList } from '@shopify/flash-list'
import { CustomList } from '@rific/scroll-view'

<CustomList component={FlashList} data={items} renderItem={renderItem} estimatedItemSize={80} />
```

| Prop | Type | Description |
|------|------|-------------|
| `chipProps` | `ChipProps` | Customize the scroll-to-top chip (label, style, etc.) |
| `component` | `ComponentType<P>` | The list component to render |
| `footerFixed` | `boolean` | Pin footer; overrides provider |
| `gesture` | `GestureType` | Compose with an external RNGH gesture |
| `headerFixed` | `boolean` | Pin header; overrides provider |
| `keyboardAware` | `boolean` | Add keyboard height to bottom content inset |
| `onRefresh` | `() => Promise<void> \| void` | Enables pull-to-refresh |
| `pullSearchHeight` | `number` | Reserve space above content for `PullSearch` |
| `refreshing` | `boolean` | Controlled refreshing state |
| `renderFilters` | `ReactNode` | Rendered below `ListHeaderComponent`, above list items |
| `scrollRef` | `RefObject<{ scrollToOffset }>` | Forward ref to the underlying list |

The underlying component receives `contentInset`, `contentOffset`, `onScroll`, `refreshControl`, and `scrollEventThrottle` — props it must support for the library to function.

---

### `ChipProps`

Passed via `chipProps` on any scroll component to customise the floating scroll-to-top chip. Accepts all `Chip` props from `@rific/auto-paper` except `compact`, `icon`, and `onPress` (which are managed by the library), plus:

| Prop | Type | Description |
|------|------|-------------|
| `label` | `ReactNode` | Override the default label ("Top" / "Start") |
| `style` | `ViewStyle` | Merged with the chip's default style |

```tsx
<FlatList
  chipProps={{ label: 'Back to top', style: { opacity: 0.9 } }}
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
/>
```

---

### `PullSearch`

A search bar that lives above the list content and is revealed by pulling down. Use alongside `pullSearchHeight` on the scroll component.

```tsx
import { useRef, useState } from 'react'
import { FlatList, PullSearch, type PullSearchHandle } from '@rific/scroll-view'

export default function SearchScreen() {
  const searchRef = useRef<PullSearchHandle>(null)
  const [query, setQuery] = useState('')
  const [searchHeight, setSearchHeight] = useState(0)

  return (
    <ScrollViewProvider>
      <ScrollViewHeader title="Search" />
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pullSearchHeight={searchHeight}
        ListHeaderComponent={
          <PullSearch
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            onHeightChange={setSearchHeight}
            placeholder="Search…"
            debounce
          />
        }
      />
    </ScrollViewProvider>
  )
}
```

| Prop | Type | Description |
|------|------|-------------|
| `onChangeText` | `(text: string) => void` | Called with trimmed search text |
| `onHeightChange` | `(height: number) => void` | Required — pass the height back as `pullSearchHeight` |
| `value` | `string` | Controlled value |
| `placeholder` | `string` | Placeholder text |
| `debounce` | `boolean` | Debounce `onChangeText` by 500ms |

**Ref methods**: `focus()`, `blur()`

---

## Keyboard awareness

Pass `keyboardAware` to any scroll component (`ScrollView`, `FlatList`, `SectionList`, `CustomList`) to add the keyboard's height to the bottom content inset, so a focused field near the bottom of the content stays above the keyboard instead of getting hidden behind it.

```tsx
<ScrollViewProvider>
  <ScrollViewHeader title="Edit profile" />
  <ScrollView keyboardAware>
    <TextInput label="Name" />
    <TextInput label="Bio" multiline />
  </ScrollView>
</ScrollViewProvider>
```

By default, a fixed `ScrollViewFooter` doesn't follow the keyboard — it stays pinned to the screen bottom and the keyboard simply covers it. If the footer holds something the user needs while typing (a submit button, say), set `footerAboveKeyboard` on `ScrollViewProvider` so the footer floats above the keyboard instead, reachable without dismissing it first:

```tsx
<ScrollViewProvider footerFixed footerAboveKeyboard>
  <ScrollViewHeader title="Edit profile" />
  <ScrollView keyboardAware>
    <TextInput label="Name" />
    <TextInput label="Bio" multiline />
  </ScrollView>
  <ScrollViewFooter>
    <Button mode="contained" onPress={handleSubmit}>Save</Button>
  </ScrollViewFooter>
</ScrollViewProvider>
```

`footerAboveKeyboard` only has an effect when the footer is fixed (`footerFixed`) — a footer that scrolls away with content has nothing to reserve keyboard space for. Always pair it with `keyboardAware: true` on any scroll component that could have a focused input while it's visible. Content always reserves space for the current footer height regardless of `keyboardAware` (so a fixed footer never overlaps it) — and while floating, that height already includes the keyboard, so a list with `keyboardAware: false` ends up reserving keyboard space anyway, just indirectly through the footer rather than directly. There's no useful configuration where you'd want the footer reachable above the keyboard but *not* want that same list's own content clear of it too, so don't rely on `keyboardAware: false` to opt a list out of this while `footerAboveKeyboard` is on — it won't.

Floating is done by growing the footer's own container rather than translating it, so its `BlurView` backdrop always stays sealed against the true physical screen bottom — nothing shows through beneath it, including at the keyboard's rounded top corners.

While floating above an open keyboard, the footer also drops its safe-area bottom inset — it's no longer sitting at the physical screen edge, so that padding would just be dead space under its content. As the keyboard closes, the inset ramps back in continuously over the last bit of its travel rather than snapping back once it's fully closed, so the content settles at the safe-area line smoothly instead of dropping to the physical bottom edge and correcting back up.

Keyboard awareness is native-only — `useKeyboardInset` (and therefore `keyboardAware`/`footerAboveKeyboard`) always resolves to `0` height on web.

---

## Persistent bottom chrome (hiding a tab bar with scroll)

A `ScrollViewFooter` hides on scroll, but an app's tab bar lives outside this package — it stays put, and the footer has to be lifted above it with `tabBarHeight`. `ScrollViewChromeProvider` turns the two into one rigid stack: the screen's footer and the tab bar share a single animated offset, so they hide and reveal together as one piece, frame for frame.

Three pieces make it work:

1. **Host** — mount `ScrollViewChromeProvider` above the navigator, giving it the bar's `footprint`.
2. **Screens** — nothing to change. Each `ScrollViewProvider` (and its `ScrollViewHeader`, `ScrollViewFooter`, scroll component) below the host joins it while its screen is focused.
3. **Bar** — your own tab bar reads the shared offset with `useScrollViewChromeStyle()` and applies it as an animated style. It has to overlay the screen (absolutely positioned at the bottom) with a resting box exactly `footprint` tall, since hosted footers are lifted by that number.

```tsx
// app/(tabs)/_layout.tsx
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { ScrollViewChromeProvider, useScrollViewChromeReveal, useScrollViewChromeStyle } from '@rific/scroll-view'
import { Tabs, useIsFocused } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TAB_ROW = 48

const TabBar = ({ navigation, state }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets()
  const chromeStyle = useScrollViewChromeStyle()
  const reveal = useScrollViewChromeReveal()
  return (
    <Animated.View style={[styles.bar, { height: TAB_ROW + insets.bottom, paddingBottom: insets.bottom }, chromeStyle]}>
      {state.routes.map((route, index) => (
        <Pressable
          key={route.key}
          style={styles.tab}
          onPress={() => {
            navigation.navigate(route.name)
            // Tapping the tab you're already on brings the bar back
            if (state.index === index) reveal()
          }}
        >
          <Text>{route.name}</Text>
        </Pressable>
      ))}
    </Animated.View>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <ScrollViewChromeProvider footprint={TAB_ROW + insets.bottom} useIsActive={useIsFocused}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />} />
    </ScrollViewChromeProvider>
  )
}

const styles = StyleSheet.create({
  bar: { bottom: 0, flexDirection: 'row', left: 0, position: 'absolute', right: 0 },
  tab: { alignItems: 'center', flex: 1, height: TAB_ROW, justifyContent: 'center' }
})
```

Screens are written exactly as they were — there is no chrome-specific prop on the happy path:

```tsx
// app/(tabs)/library.tsx
export default function Library() {
  return (
    <ScrollViewProvider>
      <ScrollViewHeader title="Library" />
      <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item.id} />
      <ScrollViewFooter>
        <Button onPress={addItem}>Add</Button>
      </ScrollViewFooter>
    </ScrollViewProvider>
  )
}
```

### Pinning the bar

`useScrollViewChromePin(active)` holds the bar fully revealed — and stops scroll from hiding it — for as long as `active` is `true`. Use it whenever something on screen needs the bar to stay put, such as a focused search field or a multi-select in progress. Pins are counted, so two independent pinners can't release each other, and it works from any component under the host (below a `ScrollViewProvider` too).

```tsx
function SearchField() {
  const [focused, setFocused] = useState(false)
  useScrollViewChromePin(focused)
  return <Searchbar onBlur={() => setFocused(false)} onFocus={() => setFocused(true)} />
}
```

`useScrollViewChromeReveal()` returns a function that animates the bar back to fully revealed (200ms) — handy for a tab press or a "scroll to top" action, as in the example above.

### Nested providers that aren't screens

A `ScrollViewProvider` nested inside another one never sees the host: every hosted provider clears it for its own children, so a panel inside a screen can't compete with its parent. A picker or form modal is the exception — a portal can re-parent it out from under its screen's provider, and it would then claim the host and drive the bar from its own scrolling. Pass `chrome={false}` to opt those out:

```tsx
<ScrollViewProvider chrome={false} footerFixed>
  <ScrollViewHeader title="Choose a category" />
  <FlatList data={categories} renderItem={renderCategory} keyExtractor={(item) => item.id} />
</ScrollViewProvider>
```

`chrome={false}` gives you exactly the unhosted behavior described in the rest of this README.

### What changes for a hosted screen

- **The footer joins the stack.** It sits `footprint` above the screen bottom, translates by the shared offset (clamped to the full hide distance), and pads its bottom by `overhang` instead of the safe-area inset — the bar's `footprint` already includes that inset.
- **Hide distance.** The stack slides `footprint + max(footerHeight, overhang) + 2` points: the bar, plus the screen's footer (whose measured height already includes the `overhang` padding; with no footer, just the `overhang`), plus 2 points of slack so a soft shadow bleeding past the bar's box doesn't leave a sliver at the screen edge.
- **Footer snap-back is forced.** A hosted footer follows the host's `snapBack` (default `true`) whatever the provider, `snapBackFooter` or settings values say, so the stack reveals on a short scroll-up from anywhere in a list. The header's own snap-back is untouched.
- **Scrolling stops at an end.** Hiding tracks the scroll 1:1, so a drag can end with the stack half hidden. When a drag ends without momentum, or momentum ends, the stack animates (200ms) to whichever end is nearer — fully shown or fully hidden, never cut off.
- **Short lists never hide.** A list that can't scroll at least the hide distance would strand the stack half hidden, so it never starts hiding and stays revealed.
- **Footer Lock keeps it revealed.** A fixed footer (`footerFixed`, `fixed`, or the settings default) stops the scroll handlers from writing the offset, and turning it on while the stack is hidden animates the stack back. The hosted footer still reads the shared offset rather than pinning itself to zero, so the footer and the bar stay equal on every frame, including that animation.
- **The focused screen owns the bar.** Screens that are mounted but unfocused never write the offset. Whenever ownership changes — switching tabs, or landing on a screen with no `ScrollViewProvider` at all — the stack resets to fully revealed instead of staying wherever the last screen parked it. A pin engaging does the same.
- **The reserved bottom inset stays constant while hidden.** Scroll content reserves `footprint` plus the overhang (or a fixed footer's height) at the bottom. That space can't animate, so it stays reserved as the bar slides away rather than the list resizing mid-scroll — the last row can always scroll clear of a revealed bar, and nothing shifts when the bar hides.
- **`tabBarHeight` is ignored.** The host's `footprint` is the same "reserve this much at the bottom" number, just known exactly, and takes its place.
- **With a fixed footer floating above the keyboard** (`footerFixed` + `footerAboveKeyboard`), the footer sits above whichever is taller, the bar or the keyboard, instead of floating a whole bar-height above the keyboard.

Outside a host — or in a provider with `chrome={false}` — none of this applies and every behavior in the rest of this README is unchanged. `useScrollViewChromeStyle`, `useScrollViewChromePin` and `useScrollViewChromeReveal` are also inert there (a permanent zero translate, a no-op pin and a no-op reveal), so a shared tab bar component can call them unconditionally.

---

## Hooks

### `useScrollView`

Access scroll state and progress control from anywhere inside a `ScrollViewProvider`.

```tsx
const { scrollPosition, scrollHeight, progressing, progress, setProgress, setProgressing } = useScrollView()
```

| Return | Type | Description |
|--------|------|-------------|
| `scrollPosition` | `SharedValue<number>` | Live scroll offset (Reanimated worklet-safe) |
| `scrollHeight` | `number` | Visible scroll area height (window minus header/footer) |
| `progressing` | `boolean` | Whether the header progress bar is visible |
| `progress` | `number \| null` | Progress bar value (0–1), or `null` for indeterminate |
| `setProgress` | `(p: number \| null) => void` | Set progress; pass `null` for indeterminate |
| `setProgressing` | `(b: boolean) => void` | Show/hide the progress bar |

```tsx
// Show an indeterminate progress bar while loading
useEffect(() => {
  setProgressing(true)
  fetchData().finally(() => setProgressing(false))
}, [])
```

---

### `useScrollViewSettings`

Read and update scroll settings at runtime from anywhere inside `ScrollViewSettingsProvider`.

```tsx
const { settings, set } = useScrollViewSettings()

// Toggle snap-back on the fly
set({ snapBack: true })
```

---

### `useKeyboardInset`

Returns the current keyboard height, updating as the keyboard animates in and out. Useful when you need the keyboard height outside of a scroll component.

```tsx
const keyboardHeight = useKeyboardInset()
```

---

### `useScrollViewChromeStyle`

For the persistent bar hosted by [`ScrollViewChromeProvider`](#scrollviewchromeprovider). Returns an animated style (`translateY` from the shared offset) to apply to an `Animated.View`, so the bar moves in lockstep with the focused screen's footer. Outside a host it is a permanent zero translate.

```tsx
const chromeStyle = useScrollViewChromeStyle()
return <Animated.View style={[styles.bar, chromeStyle]}>{/* tabs */}</Animated.View>
```

---

### `useScrollViewChromePin`

Holds the hosted bar fully revealed, and stops scroll from hiding it, while `active` is `true`. Pins are ref-counted, so independent pinners can't release each other. Inert outside a host.

```tsx
useScrollViewChromePin(searchFocused)
```

---

### `useScrollViewChromeReveal`

Returns a `() => void` that animates the hosted bar back to fully revealed (200ms). Returns a no-op outside a host.

```tsx
const reveal = useScrollViewChromeReveal()
```

See [Persistent bottom chrome](#persistent-bottom-chrome-hiding-a-tab-bar-with-scroll) for all three in context.

---

## Redux integration

If your app uses Redux, you can drive scroll settings from the store instead of (or in addition to) `ScrollViewSettingsProvider`.

```ts
// store.ts
import { scrollViewReducer } from '@rific/scroll-view'

export const store = configureStore({
  reducer: {
    scrollView: scrollViewReducer,
    // ...
  }
})
```

```ts
// Dispatch initial settings (e.g. from a remote config)
store.dispatch(scrollViewActions.initialize({ snapBack: true, headerFixed: false, footerFixed: false, backActionFixed: true }))
```

---

## Settings reference

`ScrollViewSettings` defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `headerFixed` | `false` | Pin header globally |
| `footerFixed` | `false` | Pin footer globally |
| `snapBack` | `false` | Snap header and footer back when scrolling up |
| `snapBackHeader` | — | Override `snapBack` for header only |
| `snapBackFooter` | — | Override `snapBack` for footer only |
| `backActionFixed` | `true` | Keep back button visible as header scrolls away |

Settings cascade: `ScrollViewSettingsProvider` → `ScrollViewProvider` → individual scroll component props. More specific values always win.

One exception: inside a `ScrollViewChromeProvider`, a footer's snap-back comes from the host's `snapBack` prop rather than this cascade (see [Persistent bottom chrome](#persistent-bottom-chrome-hiding-a-tab-bar-with-scroll)).
