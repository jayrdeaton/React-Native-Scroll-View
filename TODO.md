# TODO

## Move off gesture-handler's deprecated `Gesture` builder

Shipped 2026-10-16 with the peer range raised to `react-native-gesture-handler >=2.0.0 <4.0.0` so Expo SDK 58 apps (gesture-handler 3.3) can use it, but the code still uses the builder API (`Gesture.Native()` wrapping the scroll views), which 3.x marks deprecated and says it will remove. Move to the 3.x hooks (`useNativeGesture`) with `GestureDetector`; that makes 3.0 the peer floor, so release it as a major (2.0.0, since the package is past 1.0) once every consumer is on SDK 58.

## Check gestures on a device under gesture-handler 3

The tests mock `react-native-gesture-handler` (`src/__mocks__/react-native-gesture-handler.ts`), so they passed against 3.3 without running it. Before relying on it, try scrolling with the pull-to-search header, sticky headers and keyboard insets, in Snake and Hangman in an SDK 58 dev build.

## React Native 0.88 strict types

Checked 2026-10-16 with only the `react-native` condition (the fleet defers strict types through `@infinitetoken/tsconfig` 0.6). This package's own source fails in 17 places, mostly ref and scroll-event types: `src/FlatList.tsx:185`, `src/PullSearch.tsx:36,37,40,96`, `src/ScrollView.tsx:75,90,94,113`, `src/ScrollViewFooter.tsx:130`, `src/ScrollViewHeader.tsx:143`, `src/SectionList.tsx:88,93,147,185`. It also type-checks auto-paper's source (3 more, see auto-paper's TODO.md). Fix and release before the fleet moves past SDK 58.

## Revisit the floating header and footer

Jay, 2026-11-15: the floating blurred header and footer feel overbaked now. Revisit whether the lists should keep them, simplify them, or drop them for a plain header with content scrolling under it. Lumber already moved its screens off `ScrollViewHeader` to a plain header of its own. Decide this before giving the lists an edge fade (auto-paper's `FadingScrollView`, a masked fade of 24pt at each edge while there's more past it): with blurred chrome a fade fights the blur, since faded content leaves the frosted header nothing to frost. Without chrome it's the cue that rows continue. A fade on the lists would also mask the pull to refresh spinner and pull-to-search in the top band, and the masked view draws its content offscreen on Android, a cost to measure on long FlatLists first. An opt-in prop is a minor.
