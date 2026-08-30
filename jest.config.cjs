module.exports = require('@infinitetoken/jest-config/react-native')({
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^react-native-reanimated$': '<rootDir>/src/__mocks__/react-native-reanimated.ts',
    '^react-native-keyboard-controller$': '<rootDir>/src/__mocks__/react-native-keyboard-controller.ts',
    '^react-native-gesture-handler$': '<rootDir>/src/__mocks__/react-native-gesture-handler.ts',
    '^react-native-safe-area-context$': '<rootDir>/src/__mocks__/react-native-safe-area-context.ts',
    '^react-native-paper$': '<rootDir>/src/__mocks__/react-native-paper.ts',
    '^@rific/auto-paper$': '<rootDir>/src/__mocks__/auto-paper.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs']
})
