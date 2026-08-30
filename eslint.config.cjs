const { defineConfig } = require('eslint/config')
const base = require('@infinitetoken/eslint-config/react-native')

module.exports = defineConfig([
  ...base,
  {
    rules: {
      // Only the two rules that apply cleanly to a plain (non-React-Compiler) reanimated
      // codebase — the plugin's other "recommended" rules (immutability/purity/set-state-in-*/
      // gating/config) target React Compiler compatibility and would false-positive heavily on
      // reanimated worklets, which mutate .value by design.
      'react-hooks/rules-of-hooks': 'error',
      // additionalHooks covers reanimated's single-factory worklet hooks (useAnimatedStyle/
      // useAnimatedProps/useDerivedValue — the (factory, deps) shape this rule actually
      // understands). Deliberately NOT useAnimatedReaction: it takes THREE arguments
      // (prepare, reaction, deps), and this rule's additionalHooks mechanism only supports the
      // two-argument (callback, deps) shape — pointed at a 3-arg hook it misattributes the
      // `reaction` callback itself as "the deps array" and reports a confusing "not an array
      // literal" error instead of checking the real (3rd-argument) array. useAnimatedReaction call
      // sites need the same manual care (every SharedValue the `prepare` function reads must be in
      // the real trailing array) — see the comment on each existing call for why — just without lint
      // backup. This is exactly the bug class fixed throughout this package on 2026-08-03: a
      // SharedValue read inside one of these but missing from its own array silently stops reacting
      // to that value's mutations on web (no Babel plugin there to auto-inject it, unlike native) —
      // in the worst case (no array at all) it throws outright instead. 'error' (not 'warn') because
      // every real hit so far was one of those two, never a legitimate exception worth silencing.
      'react-hooks/exhaustive-deps': ['error', { additionalHooks: '(useAnimatedStyle|useAnimatedProps|useDerivedValue)' }],
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off'
    }
  }
])
