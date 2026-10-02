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
npm test             # Jest (21 suites, 454 tests as of 2026-09-19 — see Testing)
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
  ScrollViewContext.ts               - shared scroll state: blur flag, header/footer height + fixed flag + Reanimated SharedValue offsets, progress/scrollHeight/scrollPosition, JS-thread scroll counter; plus the chrome-host fields (chromeHosted, chromeOverhang, chromeWritable, stackHeightShared) — see "Chrome host"
  ScrollViewChromeContext.ts         - the TWO chrome-host contexts: ScrollViewChromeHostContext (claim machinery, cleared by every hosted ScrollViewProvider for its own children) and ScrollViewChromeContext (public face: shared offset, footprint, overhang, addPin/removePin, reveal; never cleared). Neither context object is exported from index.ts
  ScrollViewChromeProvider.tsx       - mounted above a navigator: owns the ONE shared offset SharedValue, the claim stack, ref-counted pins and reveal(); props footprint (required), overhang, snapBack, useIsActive
  ScrollViewSettingsContext.ts       - app-wide default settings context (backActionFixed, footerFixed, headerFixed, snapBack, snapBackFooter/snapBackHeader) + defaultScrollViewSettings
  ScrollViewProvider.tsx             - top-level provider wiring ScrollViewContext (blur via @rific/auto-paper's useBlur, header/footer state, shared values) around a screen; also decides whether it is "hosted" by an enclosing ScrollViewChromeProvider (`chrome` prop opts out), swaps in the host's offset/footprint/snap-back, and re-provides a null host to its children
  ScrollViewSettingsProvider.tsx     - provider for ScrollViewSettingsContext; accepts initialValue/onChange
  ScrollViewHeader.tsx               - floating/collapsible header: Appbar back action, title, progress bar, blur chrome via @rific/auto-paper's BlurView
  ScrollViewFooter.tsx               - floating/collapsible footer with blur chrome, keyboard-aware offset via useKeyboardInset; hosted, it sits `footprint` above the bottom and translates by the host's shared offset
  ScrollView.tsx                     - drop-in RN ScrollView wrapper wired into the shared scroll/gesture/chip system (UI-thread scroll handler)
  FlatList.tsx                       - drop-in RN FlatList wrapper (JS-thread scroll handler), horizontal paging dots
  SectionList.tsx                    - drop-in RN SectionList wrapper with sticky section headers (useStickyHeaders)
  CustomList.tsx                     - generic wrapper for other scrollable list components via component injection
  PullSearch.tsx                     - pull-to-reveal search bar driven by iOS overscroll; forwardRef handle (focus/blur)
  useKeyboardInset.ts                - keyboard height hook: native (iOS & Android) via react-native-keyboard-controller's useKeyboardHandler, no-op fallback on web only
  useScrollInit.ts                   - shared scroll init: header/footer measurement, remount sync, snap-back animation, chip state
  useScrollView.ts                   - public hook: progress/progressing/scrollHeight/scrollPosition/setProgress/setProgressing from context
  useScrollViewChrome.ts             - public hooks for a persistent bar under a chrome host: useScrollViewChromeStyle (animated translateY from the shared offset), useScrollViewChromePin (ref-counted hold-revealed), useScrollViewChromeReveal; all inert outside a host
  useScrollViewSettings.ts           - public hook: reads ScrollViewSettingsContext
  internal/
    ChromeRegistrar.tsx               - rendered by a hosted ScrollViewProvider only (a component, not a hook call, because host.useIsActive is itself a hook): claims/releases the host with useIsActive, sets chromeWritable = owner && !pinned, reveals when the provider's footerFixed turns on while owner
    chrome.ts                         - CHROME_SLACK (2) plus the worklet helpers chromeTravel (scrollable distance, inset-mode aware) and chromeSettleTarget (nearer of 0 / stackHeight)
    insetMode.ts                      - usesContentInset = Platform.OS === 'ios' (inset-vs-padding emulation switch)
    useScrollHandler.ts               - Reanimated UI-thread scroll handler (ScrollView/SectionList/CustomList path); hosted: gated by chromeWritable/hideable, settles to an end on drag end / momentum end
    useScrollHandlerJS.ts             - JS-thread scroll handler (FlatList path); same hosted behavior as the worklet handler
    useScrollList.ts                  - shared list-wrapper logic: content inset/padding, chip visibility animation, keyboard inset; hosted, the base bottom reserve is chromeOverhang instead of insets.bottom
    useStickyHeaders.ts               - SectionList sticky-header positioning/clip animation
    ScrollViewChip.tsx                - floating scroll-to-top/start chip (@rific/auto-paper's Chip); internal, not exported as a component
    HorizontalDots.tsx                - paging-dot overlay for horizontal FlatList
    RefreshControl.tsx                - thin wrapper defaulting refreshing=false
    FAB.tsx                           - thin wrapper around @rific/auto-paper's FAB; no current importers or exports — IDEAS.md names it as the planned SearchButton trigger
  redux/
    scrollViewSlice.ts                - thin binding over @rific/core's createSettingsSlice('scrollView', {initialState: defaultScrollViewSettings, fieldSetters: []}) factory - no @reduxjs/toolkit dependency, works with RTK, vanilla Redux, or no Redux. Corrected 2026-09-18: this used to be a hand-rolled reducer/actions pair; it was migrated onto the shared factory in an earlier pass but this doc was never updated to match - see @rific/core's own CLAUDE.md for the factory itself
  __mocks__/                         - 7 jest mocks: react-native, react-native-reanimated, react-native-gesture-handler, react-native-keyboard-controller, react-native-safe-area-context, react-native-paper, auto-paper
  __tests__/                         - 21 files at 2026-09-19, one per suite (see Testing)
```

### The web opacity-0 race `ScrollViewProvider` guards against

Fixed 2026-09-11. On web, a `<ScrollViewHeader>`'s `onLayout` can simply never fire on the very first mount through Expo Router, leaving `headerHeight` stuck at `null` forever — confirmed live, this was making Hangman's entire UI stay at `opacity: 0` indefinitely with no error. `ScrollViewProvider.tsx` now has a `Platform.OS === 'web'`-gated effect that falls back to `setHeaderHeight(0)` two animation frames after mount if `headerHeight` is still `null` by then, which is indistinguishable from what a genuinely header-less screen would report anyway. Native isn't affected (`onLayout` is reliable there), and the pre-existing `__DEV__` console warning still fires for the case that's an actual bug (no `<ScrollViewHeader>` ever rendered) — see the comment on the effect itself in `ScrollViewProvider.tsx` for the full reasoning. Same race category as `@tastic/core`'s `useSettledWindowDimensions`/`useSettledLayout` (see `../React-Native-Game-Core/.claude/CLAUDE.md`'s "web canvas-sizing race" section) — a first-mount measurement that never arrives on web — just a different package and a different symptom (stuck-null header height vs. a blank Skia canvas).

**2026-10-02 — that fallback was racing real measurements, and the first web frames were wrong.** Found live in CashierFu-Utility (web), three fixes:
- **Stale-closure clobber.** The header's first `onLayout` and the fallback's `setHeaderHeight(0)` routinely landed ~2ms apart in the same frame, both through a setter whose closure still saw `headerHeight === null`, so the 0 passed the "never clobber a real height" guard and overwrote it. The header never resized again, so the list kept 0 top padding under the header for good. The guards in `setHeaderHeight`/`setFooterHeight` now read refs written synchronously on every accepted call, and both setters are identity-stable.
- **`headerHeightShared` ran ahead of the commit.** It was written straight from `onLayout`, ~50ms before the padding and `useScrollInit`'s resting `scrollPosition = -headerHeight` committed, so the header's translate worklet computed `-headerHeight` and slid off-screen for a frame. It is now mirrored from state in a `useLayoutEffect`, i.e. in the same commit.
- **Pre-paint measurement.** react-native-web's `onLayout` (ResizeObserver + a `setTimeout` measure) usually lands after the two-frame fallback, and the footer's after more than a second on a cold load. So the first frames painted `headerHeight === 0` (header with no backdrop, list rows drawn up inside it) and an unmeasured footer (no backdrop, no list reserve). `ScrollViewHeader` and `ScrollViewFooter` now read their own `offsetHeight` in a mount-only, web-only `useLayoutEffect`. That runs after the DOM exists but before paint, and its state update applies synchronously before paint, so the first frame is already the final layout. A header mounting after a fallback 0 replaces it the same way. A node with no layout box (a `display:none` ancestor) reports 0 and is left to `onLayout`. The fallback stays for genuinely header-less screens.

Verifying these on web: the Claude browser pane throttles `requestAnimationFrame` (and so reanimated web style updates and ResizeObserver delivery) whenever it isn't in front, so rAF-sampled frame recordings there can show a clean load that the user doesn't see. Log the actual SharedValue/state writes instead.

## Bug fixes (2026-09-18)

**`ScrollViewFooter.tsx` mirrored `setFooterHeight` into a ref with a bare render-time assignment (`setFooterHeightRef.current = setFooterHeight`) instead of the fleet's established `useEffect(() => { ref.current = value })` idiom — found in a fleet-wide drift scan.** This package's own `eslint.config.cjs` has `react-hooks/refs` turned off entirely (not re-enabled as part of this fix — a separate, bigger decision), which is why lint never caught it here despite catching the same pattern everywhere else in the fleet. Fixed by wrapping the mirror in a no-deps `useEffect`, matching the adjacent unmount-cleanup effect's own shape in the same file. The existing comment explaining *why* a ref is used at all (avoiding a stale-closure teardown bug — see that comment for the full story) was left intact; only *how* the ref gets mirrored changed. Now `0.8.1` (patch, no API change).

## Chrome host (added 2026-09-19, unreleased at time of writing)

Lets a consumer's persistent bottom bar (CashierFu-Utility's `AppTabBar`) hide on scroll together with each screen's `ScrollViewFooter`. Public surface and usage are in the README's "Persistent bottom chrome" section; this is the design rationale. Read `ScrollViewChromeContext.ts`'s header comment first.

**Two contexts, one of them cleared.** `ScrollViewChromeHostContext` is the claim machinery (`activeId`, `claim`/`release`, `footprint`, `overhang`, `snapBack`, `useIsActive`, the shared `offset`, `pinned`, `reveal`). Every `ScrollViewProvider` reads it to decide whether it is hosted, then re-provides `null` around its own children — so a `ScrollViewProvider` nested inside a screen never sees the host and can't compete with its parent for it. `ScrollViewChromeContext` is the public face of the same host (`offset`, `footprint`, `overhang`, `addPin`/`removePin`, `reveal`) and is deliberately NOT cleared: the consumers of it (the bar, a search field calling `useScrollViewChromePin`) sit *below* a `ScrollViewProvider`. The clearing has one hole: a portal (Paper's `Portal`) can re-parent a picker/form modal out from under its provider, so a provider that isn't a screen has to say `chrome={false}` (hosted = enclosing host AND `chrome !== false`).

**One shared offset, not a mirror.** `ScrollViewChromeProvider` owns a single `offset` SharedValue. A hosted provider's `footerOffset` context value IS `host.offset` (the same object — same idea as the unhosted case below), and the bar animates from it via `useScrollViewChromeStyle`, so the footer and the bar read literally the same number on every frame. This is deliberately one value rather than a per-screen offset mirrored into the bar: a mirror lags by at least a frame and has to be reconciled every time ownership changes. Because Tabs keeps visited screens mounted, every hosted provider holds a `chromeWritable` SharedValue (starts `false` when hosted) that `ChromeRegistrar` sets to `owner && !pinned`; the scroll handlers only write the offset while it is true, so an unfocused screen can never fight the focused one.

**Claims.** `ChromeRegistrar` (mounted only when hosted, see the file list for why it's a component) claims with `host.useIsActive()` (react-navigation's `useIsFocused`, injected so the package carries no navigation dependency; it is called as a hook on every render, so it must be a stable reference). Claims are a stack, last claim wins, and release on blur/unmount hands the host back to the previous still-active claimant.

**Hosted geometry.** `footprint` is a plain prop (the bar's resting box: row + safe-area inset + hairline), not reported back by the bar, so the first render is already correct. The hosted footer sits at `bottom: footprint` (`tabBarHeight` in context is overridden by it; the `tabBarHeight` prop is ignored), and pads its own bottom by `chromeOverhang` instead of `insets.bottom`, since the footprint already contains the inset. Hide distance, in `stackHeightShared` (a per-provider SharedValue that IS `footerHeightShared` when unhosted):

```
stackHeight = footprint + max(footerHeight ?? 0, overhang) + CHROME_SLACK(2)
```

The footer's measured height already includes the overhang as bottom padding; `max` covers a screen with no footer. `overhang` is how far the bar pokes above its resting box (Utility's FAB: `max(insets.bottom - FAB_DIP, FAB_DIP) + FAB_DIAMETER - footprint`, clamped to >= 0). The slack keeps a soft shadow from leaving a sliver at the screen edge once hidden. The footer's translateY is `clamp(footerOffset, 0, stackHeight)` and deliberately ignores `footerFixed` (see Footer Lock below). `useScrollList` reserves `chromeOverhang` (not `insets.bottom`) + `tabBarHeight`(=footprint) at the bottom, and that reserve is constant while hidden: `contentInset` can't animate, so the list must not resize under the finger.

**Hideable.** The stack has to slide its whole `stackHeight` to clear the screen, so a list whose scrollable travel (`chromeTravel(maxScroll, headerHeight)`: `maxScroll + headerHeight` in inset mode, `maxScroll` in padding mode) is shorter than that never starts hiding, and a writable hosted handler forces `footerOffset` back to 0 if it isn't there already.

**Reset on claim.** The offset is per-host but the scroll state that produced it is per-screen, and nothing else zeroes it except a scroll event landing at the top of a list. `ScrollViewChromeProvider` therefore `reveal()`s (200ms `withTiming` to 0) whenever `activeId` or `pinned` changes — so popping back to a screen that was hidden when it lost focus, or focusing a screen with no scroll view at all, never leaves the bar where the last screen parked it. Pinning also turns the handlers off (`writable = owner && !pinned`), so nothing else would ever bring the bar back; the same effect covers that.

**Pins, Footer Lock, settle-to-end.**
- Pins are ref-counted (`addPin`/`removePin`, floor 0) so two pinners can't release each other; `useScrollViewChromePin(active)` wraps them.
- Footer Lock (the provider's effective `footerFixed`) stops the handlers writing the offset, and `ChromeRegistrar` reveals when it turns on while owner. The hosted footer still reads the shared offset instead of short-circuiting to 0, so the footer and the bar stay equal on the frames where the lock animates the offset home. (Only the provider-level flag is watched by the registrar; a per-list `footerFixed` prop turning on while hidden does not trigger a reveal.)
- A hosted footer's snap-back is forced to the host's `snapBack` (default true) via `snapBackFooterShared`, overriding provider/settings `snapBack`/`snapBackFooter`; the header's snap-back is untouched. Hosted footer + `footerFixed` + `footerAboveKeyboard` uses `bottom = max(footprint - keyboardHeight, 0)` so it sits above whichever of bar or keyboard is taller.
- Hosted, scroll tracks 1:1, so a drag can end half hidden. `onEndDrag` (only when velocity is undefined or |velocity.y| < 0.1 — a release with momentum settles on momentum end instead) and `onMomentumEnd` animate the offset to `chromeSettleTarget` (the nearer of 0 / `stackHeight`), but only when hosted && !footerFixed && `chromeWritable`. Both scroll handlers (`useScrollHandler`, `useScrollHandlerJS`) implement this identically; keep them in sync.

**Unhosted behavior is unchanged — this is the guarantee.** With no enclosing host (or `chrome={false}`): `chromeHosted` is false, `chromeWritable` is `true` for the provider's whole life, `stackHeightShared` is the very same SharedValue object as `footerHeightShared`, `footerOffset` is the provider's own value, the base bottom reserve is `insets.bottom`, `tabBarHeight` is the prop, and every hosted branch in the footer/handlers/list hook is skipped. The `useScrollViewChrome*` hooks are inert there (a zero fallback SharedValue, no-op pin, no-op reveal), so a shared bar component can call them unconditionally.

## Public API

From `src/index.ts` (single entry point, no subpath exports):

- Components: `CustomList`, `FlatList`, `PullSearch`, `ScrollView`, `ScrollViewChromeProvider`, `ScrollViewFooter`, `ScrollViewHeader`, `ScrollViewProvider`, `ScrollViewSettingsProvider`, `SectionList`
- Hooks: `useKeyboardInset`, `useScrollView`, `useScrollViewChromePin`, `useScrollViewChromeReveal`, `useScrollViewChromeStyle`, `useScrollViewSettings`
- Context objects: `ScrollViewContext`, `ScrollViewSettingsContext`
- Redux: `scrollViewActions`, `scrollViewReducer`
- Values: `defaultScrollViewSettings`
- Types: `CustomListProps`, `FlatListProps`, `ChipProps`, `PullSearchHandle`, `PullSearchProps`, `ScrollViewProps`, `ScrollViewChromeProviderProps`, `ScrollViewContextType`, `ScrollViewFooterProps`, `ScrollViewHeaderProps`, `ScrollViewProviderProps`, `ScrollViewSettings`, `ScrollViewSettingsContextType`, `ScrollViewSettingsProviderProps`, `SectionListProps`

Note: `ChipProps` is exported (for the `chipProps` prop on the list components) but the `ScrollViewChip` component itself is internal-only, not exported. `internal/`'s hooks (`useScrollHandler`, `useScrollHandlerJS`, `useScrollList`, `useStickyHeaders`, `insetMode`), `chrome.ts`, `ChromeRegistrar.tsx` and `FAB.tsx` are implementation details, not part of the public API. Neither chrome context (`ScrollViewChromeHostContext`, `ScrollViewChromeContext`) is exported either — consumers reach the host only through `ScrollViewChromeProvider` and the three `useScrollViewChrome*` hooks.

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
- 21 suites, 454 tests (`npx jest --coverage=false`, counted 2026-09-19 after the chrome-host work landed; the earlier "13 suites, 88 tests, confirmed 2026-08-30" was stale by then)
- Coverage is enforced, not just measured: `@infinitetoken/jest-config/react-native` turns `collectCoverage` on by default, so plain `npm test` (and `verify`) fails below the shared preset's `coverageThreshold.global` of 70% branches/functions/lines/statements. `jest.config.cjs` sets **no** `coverageThreshold` override — it only passes `moduleNameMapper` (the seven mocks) and `setupFilesAfterEnv`, and git history shows it never carried one. (An earlier revision of this file claimed a lowered `{ branches: 55, functions: 63, lines: 77, statements: 74 }` floor; that override doesn't exist and must not be assumed.) `coverage/` is gitignored, and its `coverage-summary.json` is a stale leftover from 2026-08-30, not written by the current reporters (`text`, `lcov`, `html`) — don't read numbers from it.
- Coverage snapshot, 2026-09-19 (same run as the counts above): 92.14% statements / 83.89% branches / 80.45% functions / 93.11% lines, above the 70 floor on all four. Weakest spots then: `FlatList.tsx` (~76% stmts / ~57% branches / ~61% functions) and `SectionList.tsx` (~70% / ~51% / ~48%); the chrome-host files (`ScrollViewChromeProvider.tsx`, `ChromeRegistrar.tsx`, `chrome.ts`, `useScrollViewChrome.ts`) and both scroll handlers were at 100% statements. The old note that `useScrollHandler.ts` was "effectively untested" and that `ScrollViewSettingsProvider.tsx`/`useScrollViewSettings.ts`/`internal/FAB.tsx`/`redux/scrollViewSlice.ts` had zero coverage no longer holds — each has its own suite now.

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
