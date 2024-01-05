import { defineConfig } from "vite"

import typescript from "@rollup/plugin-typescript"
import { resolve } from "path"
import { copyFileSync } from "fs"
import { typescriptPaths } from "rollup-plugin-typescript-paths"
import tsconfigPaths from 'vite-tsconfig-paths'
import dts from 'vite-plugin-dts'

export default defineConfig({
  base: './',
  plugins: [
    tsconfigPaths(),
    dts({
      afterBuild: () => {
        copyFileSync("dist/index.d.ts", "dist/index.d.mts")
      },
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
    ],
    extensions: ['.ts']
  },
  build: {
    manifest: true,
    minify: false,
    reportCompressedSize: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: (format) => `index.${format}.js`,
      formats: ['es'],
      name: 'Jackal.js'
    },
    rollupOptions: {
      external: [
        /* Jackal.js-protos */
        /@cosmjs.*/,
        /cosmjs-types*/,
        'grpc-web',
        'protobufjs',
        'ts-proto',
        /* Jackal.js */
        'browserify-sign',
        'browserify-aes',
        'browserify-des',
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
