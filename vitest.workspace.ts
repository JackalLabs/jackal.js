import { defineWorkspace } from 'vitest/config'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
        'src/tests/**/*.{test,spec}.ts',
      ],
      name: 'unit',
      environment: 'node',
    },
  },
  {
    plugins: [
      nodePolyfills({ include: ['buffer', 'util'] })
    ],
    test: {
      globals: true,
      alias: [
        {
          find: '@',
          replacement: resolve(__dirname, './src'),
        }
      ],
      include: [
        'src/tests/**/*.{test,spec}.ts',
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
