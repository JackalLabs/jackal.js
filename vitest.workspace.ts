import { defineWorkspace } from 'vitest/config'
import { resolve } from 'path'

export default defineWorkspace([
  {
    test: {
      globals: true,
      alias: [
        {
          find: '@',
          replacement: resolve(__dirname, './src'),
        },
      ],
      include: [
        'tests/**/*.{test,spec}.ts',
      ],
      name: 'unit',
      environment: 'node',
    },
  },
  {
    test: {
      globals: true,
      alias: [
        {
          find: '@',
          replacement: resolve(__dirname, './src'),
        },
      ],
      include: [
        'tests/**/*.{test,spec}.ts',
      ],
      name: 'browser',
      browser: {
        enabled: true,
        instances: [
          { browser: 'chromium' },
        ],
      },
    },
  },
])
