import { defineConfig } from 'vite'

export default defineConfig({
  base: '/_experiences/cdx-2089-music-player/',
  server: {
    port: 5199,
    strictPort: true,
  },
  preview: {
    port: 5199,
    strictPort: true,
  },
})
