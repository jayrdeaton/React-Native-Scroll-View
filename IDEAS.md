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
