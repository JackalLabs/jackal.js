import { defineConfig } from "vite"

import typescript from "@rollup/plugin-typescript"
import { resolve } from "path"
import { typescriptPaths } from "rollup-plugin-typescript-paths"
import tsconfigPaths from 'vite-tsconfig-paths'
import dts from 'vite-plugin-dts'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  base: './',
  plugins: [
    tsconfigPaths(),
    dts({
      include: ["src"],
      rollupTypes: true,
      logLevel: 'error'
    }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: [
      {
        find: "@",
        replacement: resolve(__dirname, "./src"),
      },
      {
        find: "function-bind",
        replacement: resolve(__dirname, "./node_modules", "function-bind", "implementation.js"),
      },
      {
        find: "symbol-observable/ponyfill",
        replacement: resolve(__dirname, "./node_modules", "symbol-observable", "ponyfill.js"),
      },
      {
        find: 'browserify-aes',
        replacement: resolve(__dirname, "./node_modules", "@jackallabs", "browserify-aes"),
      },
    ],
    extensions: ['.ts']
  },
  build: {
    manifest: true,
    minify: false,
    reportCompressedSize: true,
    rollupOptions: {
      input: resolve(__dirname, "src/index.ts"),
      preserveEntrySignatures: 'allow-extension',
      output: [
        {
          dir: './dist',
          entryFileNames: 'index.cjs.js',
          format: 'cjs',
          name: 'Jackal.js',
          plugins: []
        },
        {
          dir: './dist',
          entryFileNames: 'index.esm.js',
          format: 'esm',
          name: 'Jackal.js',
          plugins: [
            nodePolyfills({ include: ['buffer', 'util'] })
          ]
        }
      ],
      external: [
        /* Jackal.js-protos */
        /@cosmjs.*/,
        /cosmjs-types*/,
        'grpc-web',
        'ts-proto',
        /* Jackal.js */
        'ripemd160',
        'create-hash',
        'for-each',
      ],
      plugins: [
        typescriptPaths({
          absolute: false,
        }),
        typescript({ tsconfig: './tsconfig.json' }),
      ],
    },
  },
})
