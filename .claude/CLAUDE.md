# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# @rific/scroll-view

Blur-chrome scroll system for React Native — drop-in replacements for `ScrollView`, `FlatList`, and `SectionList` with floating headers/footers, pull-to-search, keyboard awareness, horizontal paging, and frosted-glass chrome.

Part of the `@rific` package ecosystem. Published at https://www.npmjs.com/package/@rific/scroll-view (`publishConfig.access: public`, no `private` field).

## Commands

```bash
npm run lint         # ESLint
npm run fix          # ESLint --fix
npm run build        # tsup, outputs CJS + ESM + types to dist/
npm run build:watch  # tsup --watch
npm test             # Jest (13 suites, 88 tests)
npm run test:watch   # Jest --watchAll --coverage=false
npm run typecheck    # tsc --noEmit
npm run verify       # lint + test + typecheck + build, in that order
```

Always run `npm run lint` before finishing any task.

## Release

Tag-based:

```bash
npm run release:patch   # npm version patch && git push --follow-tags (or release:minor / release:major)
```

`preversion` runs `npm run verify` first. `prepublishOnly` runs `npm run build`. `publish.yml` fires on `v*` tags and delegates to the shared reusable workflow (`infinitetoken/Workflows/.github/workflows/npm-publish.yml@v1`) with `id-token: write` permission. `ci.yml` runs on every PR and push to `main` via the shared `npm-ci.yml` reusable workflow.

## Architecture

```
src/
  index.ts                          - public export barrel
  ScrollViewContext.ts               - shared scroll state: blur flag, header/footer height + fixed flag + Reanimated SharedValue offsets, progress/scrollHeight/scrollPosition, JS-thread scroll counter
  ScrollViewSettingsContext.ts       - app-wide default settings context (backActionFixed, footerFixed, headerFixed, snapBack, snapBackFooter/snapBackHeader) + defaultScrollViewSettings
  ScrollViewProvider.tsx             - top-level provider wiring ScrollViewContext (blur via @rific/auto-paper's useBlur, header/footer state, shared values) around a screen
  ScrollViewSettingsProvider.tsx     - provider for ScrollViewSettingsContext; accepts initialValue/onChange
  ScrollViewHeader.tsx               - floating/collapsible header: Appbar back action, title, progress bar, blur chrome via @rific/auto-paper's BlurView
  ScrollViewFooter.tsx               - floating/collapsible footer with blur chrome, keyboard-aware offset via useKeyboardInset
  ScrollView.tsx                     - drop-in RN ScrollView wrapper wired into the shared scroll/gesture/chip system (UI-thread scroll handler)
  FlatList.tsx                       - drop-in RN FlatList wrapper (JS-thread scroll handler), horizontal paging dots
  SectionList.tsx                    - drop-in RN SectionList wrapper with sticky section headers (useStickyHeaders)
  CustomList.tsx                     - generic wrapper for other scrollable list components via component injection
  PullSearch.tsx                     - pull-to-reveal search bar driven by iOS overscroll; forwardRef handle (focus/blur)
  useKeyboardInset.ts                - keyboard height hook: native (iOS & Android) via react-native-keyboard-controller's useKeyboardHandler, no-op fallback on web only
  useScrollInit.ts                   - shared scroll init: header/footer measurement, remount sync, snap-back animation, chip state
  useScrollView.ts                   - public hook: progress/progressing/scrollHeight/scrollPosition/setProgress/setProgressing from context
  useScrollViewSettings.ts           - public hook: reads ScrollViewSettingsContext
  internal/
    insetMode.ts                     - usesContentInset = Platform.OS === 'ios' (inset-vs-padding emulation switch)
    useScrollHandler.ts               - Reanimated UI-thread scroll handler (ScrollView/SectionList/CustomList path)
    useScrollHandlerJS.ts             - JS-thread scroll handler (FlatList path)
    useScrollList.ts                  - shared list-wrapper logic: content inset/padding, chip visibility animation, keyboard inset
    useStickyHeaders.ts               - SectionList sticky-header positioning/clip animation
    ScrollViewChip.tsx                - floating scroll-to-top/start chip (@rific/auto-paper's Chip); internal, not exported as a component
    HorizontalDots.tsx                - paging-dot overlay for horizontal FlatList
    RefreshControl.tsx                - thin wrapper defaulting refreshing=false
    FAB.tsx                           - thin wrapper around @rific/auto-paper's FAB; no current importers or exports — IDEAS.md names it as the planned SearchButton trigger
  redux/
    scrollViewSlice.ts                - hand-rolled Redux slice (no @reduxjs/toolkit dependency) mirroring ScrollViewSettings; works with RTK, vanilla Redux, or no Redux
  __mocks__/                         - 7 jest mocks: react-native, react-native-reanimated, react-native-gesture-handler, react-native-keyboard-controller, react-native-safe-area-context, react-native-paper, auto-paper
  __tests__/                         - 13 files, one per suite (see Testing)
```

### The web opacity-0 race `ScrollViewProvider` guards against

Fixed 2026-09-11. On web, a `<ScrollViewHeader>`'s `onLayout` can simply never fire on the very first mount through Expo Router, leaving `headerHeight` stuck at `null` forever — confirmed live, this was making Hangman's entire UI stay at `opacity: 0` indefinitely with no error. `ScrollViewProvider.tsx` now has a `Platform.OS === 'web'`-gated effect that falls back to `setHeaderHeight(0)` two animation frames after mount if `headerHeight` is still `null` by then, which is indistinguishable from what a genuinely header-less screen would report anyway. Native isn't affected (`onLayout` is reliable there), and the pre-existing `__DEV__` console warning still fires for the case that's an actual bug (no `<ScrollViewHeader>` ever rendered) — see the comment on the effect itself in `ScrollViewProvider.tsx` for the full reasoning. Same race category as `@tastic/core`'s `useSettledWindowDimensions`/`useSettledLayout` (see `../React-Native-Game-Core/.claude/CLAUDE.md`'s "web canvas-sizing race" section) — a first-mount measurement that never arrives on web — just a different package and a different symptom (stuck-null header height vs. a blank Skia canvas).

## Public API

From `src/index.ts` (single entry point, no subpath exports):

- Components: `CustomList`, `FlatList`, `PullSearch`, `ScrollView`, `ScrollViewFooter`, `ScrollViewHeader`, `ScrollViewProvider`, `ScrollViewSettingsProvider`, `SectionList`
- Hooks: `useKeyboardInset`, `useScrollView`, `useScrollViewSettings`
- Context objects: `ScrollViewContext`, `ScrollViewSettingsContext`
- Redux: `scrollViewActions`, `scrollViewReducer`
- Values: `defaultScrollViewSettings`
- Types: `CustomListProps`, `FlatListProps`, `ChipProps`, `PullSearchHandle`, `PullSearchProps`, `ScrollViewProps`, `ScrollViewContextType`, `ScrollViewFooterProps`, `ScrollViewHeaderProps`, `ScrollViewProviderProps`, `ScrollViewSettings`, `ScrollViewSettingsContextType`, `ScrollViewSettingsProviderProps`, `SectionListProps`

Note: `ChipProps` is exported (for the `chipProps` prop on the list components) but the `ScrollViewChip` component itself is internal-only, not exported. `internal/`'s hooks (`useScrollHandler`, `useScrollHandlerJS`, `useScrollList`, `useStickyHeaders`, `insetMode`) and `FAB.tsx` are implementation details, not part of the public API.

## Peer Dependencies

All required (no `peerDependenciesMeta` — nothing optional):

- `react` >=19.0.0
- `react-native` >=0.83.0
- `@rific/auto-paper` ^0.10.0 — internal fleet package. `BlurView` (header/footer/dots chrome), `useBlur` (`ScrollViewProvider`), `Chip` (the internal scroll chip), `FAB`
- `react-native-gesture-handler` >=2.0.0 <3.0.0 — pan gesture backing the scroll-away chrome on `ScrollView`/`FlatList`/`SectionList`/`CustomList`
- `react-native-keyboard-controller` >=1.0.0 — native keyboard height tracking (`useKeyboardInset`)
- `react-native-paper` >=5.0.0 — `Appbar`/`ProgressBar`/`Surface`/`Searchbar`/`Icon`/`useTheme` across header, pull-search, and the chip
- `react-native-reanimated` >=4.0.0 — shared values, UI-thread scroll handler, animated styles throughout
- `react-native-safe-area-context` >=5.0.0 — safe-area insets for header, footer, and horizontal dots
- `react-native-worklets` 0.10.x — required transitively by Reanimated 4's `runOnUI`/UI-thread scheduling; not imported directly anywhere in `src/`

## Testing

- Framework: Jest (`@infinitetoken/jest-config/react-native`), jsdom environment
- Mocks in `src/__mocks__/` for `react-native`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-keyboard-controller`, `react-native-safe-area-context`, `react-native-paper`, `@rific/auto-paper`
- 13 suites, 88 tests (`npx jest --coverage`, confirmed 2026-08-30)
- Coverage: 74.47% statements / 55.81% branches / 63.4% functions / 77.31% lines — below the shared preset's baked-in 70/70/70/70 floor on branches and functions, so `jest.config.cjs` overrides `coverageThreshold.global` to `{ branches: 55, functions: 63, lines: 77, statements: 74 }`, floored just under the real numbers with a comment marking it a temporary floor, not a target. Weakest spots: `internal/useScrollHandler.ts` (~14% stmts, effectively untested), and zero-coverage `ScrollViewSettingsProvider.tsx`, `useScrollViewSettings.ts`, `internal/FAB.tsx`, `redux/scrollViewSlice.ts` — all real public-API or near-API gaps worth closing, not dead code.

## Code Style

Enforced by ESLint + Prettier, run `npm run lint` before finishing any task.

**Prettier config** (`@infinitetoken/eslint-config/prettier`):
- Single quotes, JSX single quotes
- No semicolons
- No trailing commas
- Print width: 1000 (effectively disabled)

**ESLint rules** (`eslint.config.cjs` extends `@infinitetoken/eslint-config/react-native`, warnings unless noted):
- `simple-import-sort` — imports and exports must be sorted
- `react-native/no-inline-styles` — no inline style objects
- `react-native/no-unused-styles` — no unused StyleSheet entries
- `no-console` — no console statements
- `@typescript-eslint/no-unused-vars` — `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern: '^_'` (unused vars/args/caught errors prefixed `_` are allowed)
- `package-json/order-properties`, `package-json/sort-collections` — on `package.json` itself
- `react-hooks/rules-of-hooks` — error, not a warning
- `react-hooks/exhaustive-deps` — error (bumped from the shared preset's `warn`), with `additionalHooks: '(useAnimatedStyle|useAnimatedProps|useDerivedValue)'` to cover Reanimated's single-factory worklet hooks. Deliberately excludes `useAnimatedReaction` (its 3-argument shape isn't what this rule's `additionalHooks` mechanism understands) — those call sites need the same care manually; see the in-file comments at each one.
- `react-hooks/refs`, `react-hooks/immutability`, `react-hooks/preserve-manual-memoization`, `react-hooks/set-state-in-effect` — all overridden **off** (the shared preset turns them on at `warn`): they target React Compiler compatibility and false-positive heavily on Reanimated worklets, which mutate `.value` by design

`tsconfig.json` is just `{ "extends": "@infinitetoken/tsconfig/react-native", "include": ["src"] }` — no local compiler-option overrides.
