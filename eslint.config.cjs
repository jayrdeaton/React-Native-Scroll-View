const { defineConfig } = require('eslint/config')
const prettierRecommended = require('eslint-plugin-prettier/recommended')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const tsParser = require('@typescript-eslint/parser')
const eslintReactNative = require('eslint-plugin-react-native')
const reactHooks = require('eslint-plugin-react-hooks')
const tsEslint = require('typescript-eslint')
const packageJson = require('eslint-plugin-package-json')

module.exports = defineConfig([
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json'
      }
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.yalc/**', 'lib/**', 'coverage/**', '**/*.js', '**/*.mjs', '**/*.cjs', 'src/__mocks__/**', 'src/__tests__/**']
  },
  ...tsEslint.configs.recommended,
  prettierRecommended,
  packageJson.configs.recommended,
  {
    extends: [packageJson.configs.recommended],
    files: ['package.json'],
    rules: {
      'package-json/order-properties': 'warn',
      'package-json/sort-collections': 'warn'
    }
  },
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-native': eslintReactNative,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'prettier/prettier': 'warn',
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
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'no-console': 'warn',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-unused-styles': 'warn',
      'react-native/no-raw-text': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
])
