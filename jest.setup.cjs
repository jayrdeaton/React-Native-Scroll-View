/* eslint-disable no-console */
global.__DEV__ = true

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in test:', reason)
})
