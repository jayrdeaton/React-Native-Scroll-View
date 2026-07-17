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
| `fixed` | `boolean` | `false` | Pin both header and footer (overrides `headerFixed`/`footerFixed`) |
| `headerFixed` | `boolean` | `false` | Pin header; overrides settings default |
| `footerFixed` | `boolean` | `false` | Pin footer; overrides settings default |
| `snapBack` | `boolean` | `false` | Snap header and footer back when scrolling up |
| `snapBackHeader` | `boolean` | — | Override `snapBack` for header only |
| `snapBackFooter` | `boolean` | — | Override `snapBack` for footer only |
| `tabBarHeight` | `number` | `60` | Used to compute safe scroll height |

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
