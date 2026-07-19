# Ideas

## `usePinchViewMode` — Pinch Gesture to Cycle List/Grid/Gallery

A hook that centralizes pinch-to-switch-view-mode logic so any consuming app gets the gesture and cycling state for free. The consumer still owns rendering and persistence.

### The core insight

Gallery, grid, and list form a single ordered axis — not three separate modes:

```
gallery ← grid(1 col) ← grid(2 col) ← ... ← grid(5 col) ← list
```

Gallery and list are just the endpoints with different `renderItem`. The hook exposes a single position on that axis.

### Proposed API

```typescript
const { columns, mode, pinchGesture } = usePinchViewMode('products', {
  modes: ['gallery', 'grid', 'list'], // which ends to include
  gridRange: [1, 5],
})

// Consumer wires it up:
<FlatList
  gesture={pinchGesture}
  numColumns={mode === 'grid' ? columns : 1}
  renderItem={mode === 'gallery' ? renderGalleryItem : mode === 'grid' ? renderGridItem : renderListItem}
/>
```

### Open questions

- **Persistence** — three options:
  - Memory only (simplest, state resets on unmount)
  - Controlled (`value` + `onChange`) — consumer owns storage, hook owns gesture logic
  - `storageKey` + storage adapter — couples the package to a storage dep, avoid unless there's a clear second consumer
- **Smooth resize** — cycling through discrete column counts is fine. True pinch-proportional resize (cells scale with gesture velocity) isn't possible with RN's `FlatList` `numColumns`; would require a `FlexWrap`/Masonry-based grid instead.

### Why a hook, not a component

The package already exposes a `gesture` prop on `FlatList`, `SectionList`, and `CustomList`. The hook slots in cleanly — build the `Gesture.Pinch()` and return it alongside `mode`/`columns`. No new component needed.

### Reference implementation

`useItemList` in CashierFu-Utility (`src/hooks/useItemList.tsx`) has a working version of the pinch gesture and `handleColumns` cycling logic. That's the pattern to extract and generalize.

## `SearchButton` — Button-Triggered Search Bar Anchored Above the Keyboard

A second search pattern alongside `PullSearch`, for platforms/layouts where a hide-until-pulled search bar doesn't fit.

### The core insight

`PullSearch`'s reveal animation rides iOS's `contentInset`/overscroll physics (see the comment in `useScrollInit.ts`: *"Pull-search rides iOS overscroll physics; outside inset mode it never engages"*). Outside inset mode — Android, and any padding-mode consumer — it can't hide/reveal on scroll, so it just renders statically instead. That's a reasonable fallback for the search *input* itself, but it gives up the "tucked away until needed" UX entirely on those platforms.

A button-triggered variant sidesteps the overscroll dependency: a trigger button opens a search bar that slides up from the bottom and tracks the live keyboard height, so it always sits right above the keyboard. `react-native-keyboard-controller` keyboard-height tracking works identically on iOS and Android, so this interaction is cross-platform by construction — not a fallback, a first-class second option.

### Proposed API

```tsx
<SearchButton
  onChangeText={handleChangeText}
  placeholder="Search fruits & vegetables…"
  debounce
  ref={searchRef}
  renderAccessory={({ value, onSelect }) => (
    <HistoryChips items={history} value={value} onSelect={onSelect} />
  )}
/>
```

Mirrors `PullSearch`'s existing prop shape (`onChangeText`, `onHeightChange`, `placeholder`, `value`, `debounce`, imperative `ref` with `focus`/`blur`) so switching between the two patterns is a near drop-in swap. Adds:
- A trigger element (button/FAB) that opens the overlay — not scroll-position-driven.
- `renderAccessory` — an optional slot rendered below the input (history chips, filters, etc.), left to the consumer rather than baked in.

### Mechanics (from the reference implementation)

1. **Trigger** — reuse the package's existing `internal/FAB.tsx` as the default; accept a `renderTrigger` override for consumers who want a plain icon button instead of a FAB.
2. **Overlay** — `react-native-paper`'s `Portal`, positioned `position: 'absolute', left: 0, right: 0, bottom: 0`, opacity-animated in on open.
3. **Keyboard tracking** — the package already exports `useKeyboardInset()`, but it returns a JS number via `runOnJS`, not a `SharedValue`. The reference implementation drives `translateY` from a true shared value updated inside the worklet directly (no bridge hop), which is smoother during the keyboard's animated transition. Worth adding a shared-value-returning sibling hook (`useKeyboardInsetShared`?) for this use case rather than accepting the extra frame of lag from the existing one.
4. **Dismiss** — swipe-down gesture (`Gesture.Pan().onEnd`, ~50pt translationY threshold) plus the normal blur-on-submit path.
5. **Value sync** — reuse `PullSearch`'s existing `propValue`/internal-`value` sync effect as-is; that mechanism itself isn't what broke on Android (see the Expo-Starter demo fix from 2026-07-19) — it was the *consuming screen* recreating the element every keystroke. Keep `SearchButton` consistent with `PullSearch`'s controlled/uncontrolled API either way.

### Open questions

- **Standalone component vs. a `PullSearch` mode?** Recommend standalone (`SearchButton.tsx`) — different interaction model (trigger+overlay vs. scroll-position-driven), and folding it into `PullSearch` would bloat that component's already-nontrivial effect chain.
- **Trigger placement** — freestanding (consumer places it anywhere, like `internal/FAB.tsx` today) vs. a dedicated slot on `ScrollViewFooter`? Recommend freestanding first; a footer slot can layer on top once the component itself is proven.
- **History** — bake in a history feature, or leave it entirely to the consumer via `renderAccessory`? Recommend leaving it to the consumer — CashierFu-Utility's version pulls from a Redux-backed `useSearchHistory`, which is app-specific and shouldn't become a package dependency (AsyncStorage/Redux) just for this.
- **Automatic Android fallback for `PullSearch`?** Once `SearchButton` exists, `PullSearch` could auto-swap to it outside inset mode instead of rendering statically. Recommend *not* doing this initially — implicit platform-based component swapping is surprising API behavior. Ship both as distinct opt-in components; a convenience wrapper can come later if the pattern proves out.

### Reference implementation

`SearchFAB.tsx` (+ `useKeyboard.ts`) in CashierFu-Utility has the working version of this exact mechanic — FAB trigger, Portal-rendered overlay, live keyboard-anchored `translateY`, swipe-to-dismiss gesture, animated show/hide. It's coupled to app-specific search infra (`useCollectionQuery`, `useSearchHistory`, `useList`) that the package version should strip out in favor of plain callback props, but the animation/gesture/keyboard-tracking mechanics translate directly.
