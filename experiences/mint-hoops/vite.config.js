import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    // Three.js and the GLTF loader are required for the first playable frame.
    // The measured production chunk is ~183 kB gzip, so the raw-size warning
    // threshold reflects this intentional real-time dependency.
    chunkSizeWarningLimit: 750,
  },
});
