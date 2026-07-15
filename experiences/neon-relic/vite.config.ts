import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5191,
    strictPort: true,
  },
  preview: {
    port: 5191,
    strictPort: true,
  },
})
