import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    modulePreload: { polyfill: false },
  },
})
