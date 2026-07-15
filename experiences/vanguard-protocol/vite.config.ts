import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5188,
    strictPort: true,
  },
  preview: {
    port: 5188,
    strictPort: true,
  },
})
