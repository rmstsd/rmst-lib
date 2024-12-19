import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'Ext',
      fileName: () => 'index.js',
      formats: ['iife'],
      cssFileName: 'index'
    }
  }
})
