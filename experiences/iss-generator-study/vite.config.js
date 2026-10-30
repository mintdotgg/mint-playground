import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // Three.js, the GLTF and Draco loaders, and OrbitControls are all needed
    // for the first rendered frame, so the single chunk is intentional.
    chunkSizeWarningLimit: 750,
  },
});
