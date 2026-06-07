/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^react-native-reanimated$': '<rootDir>/src/__mocks__/react-native-reanimated.ts',
    '^react-native-keyboard-controller$': '<rootDir>/src/__mocks__/react-native-keyboard-controller.ts',
    '^react-native-gesture-handler$': '<rootDir>/src/__mocks__/react-native-gesture-handler.ts',
    '^react-native-safe-area-context$': '<rootDir>/src/__mocks__/react-native-safe-area-context.ts',
    '^react-native-paper$': '<rootDir>/src/__mocks__/react-native-paper.ts',
    '^@rific/auto-paper$': '<rootDir>/src/__mocks__/auto-paper.ts',
    '^@shopify/flash-list$': '<rootDir>/src/__mocks__/flash-list.ts'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'CommonJS',
          moduleResolution: 'node',
          ignoreDeprecations: '5.0',
          types: ['jest', 'node']
        },
        diagnostics: false
      }
    ]
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs']
}
