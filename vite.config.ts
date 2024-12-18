import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  esbuild: {
    jsxInject: `const React  = ''`
  },
  build: {
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'Ext',
      fileName: () => 'ext.js',
      formats: ['iife'],
      cssFileName: 'ext'
    }
  }
})
