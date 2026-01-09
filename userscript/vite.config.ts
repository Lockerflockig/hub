import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'HGHub',
      fileName: () => 'hg-hub.js',
      formats: ['iife']
    },
    outDir: '../static/js',
    emptyOutDir: true,
    minify: false, // Keep readable for debugging
    sourcemap: false
  }
});
