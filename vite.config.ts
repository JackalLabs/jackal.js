import { defineConfig } from "vite"

import typescript from "@rollup/plugin-typescript"
import { resolve } from "path"
import { typescriptPaths } from "rollup-plugin-typescript-paths"
import tsconfigPaths from 'vite-tsconfig-paths'
import dts from 'vite-plugin-dts'
// @ts-ignore
// import nodePolyfills from 'vite-plugin-node-stdlib-browser'

export default defineConfig({
  base: './',
  plugins: [
    tsconfigPaths(),
    // nodePolyfills(),
    dts({ rollupTypes: true })
  ],
  resolve: {
    preserveSymlinks: true,
    alias: [
      {
        find: "@",
        replacement: resolve(__dirname, "./src"),
      },
    ],
    extensions: ['.ts']
  },
  build: {
    manifest: true,
    minify: true,
    reportCompressedSize: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: (format) => `index.${format}.js`,
      name: 'Jackal.js'
    },
    rollupOptions: {
      external: [
        /@cosmjs.*/,
        '@karnthis/plzsu',
        'bech32',
        'bip32',
        'bip39',
        'bs58check',
        'eciesjs',
        '@jackallabs/jackal.js-protos',
        'make-random',
      ],
      plugins: [
        typescriptPaths({
          absolute: false,
          // nonRelative: true,
        }),
        typescript({ tsconfig: './tsconfig.json' }),
      ],
    },
  },
})
