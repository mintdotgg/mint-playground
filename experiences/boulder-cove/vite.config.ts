import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5175,
    open: false,
  },
  assetsInclude: ['**/*.glb', '**/*.mp3', '**/*.ogg', '**/*.wav'],
  build: {
    target: 'es2020',
  },
})
