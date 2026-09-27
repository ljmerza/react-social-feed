import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-social-feed/virtual': resolve(__dirname, 'src/virtual/index.ts'),
      'react-social-feed': resolve(__dirname, 'src/index.ts')
    }
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        virtual: resolve(__dirname, 'src/virtual/index.ts')
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      // Without this Vite names the CSS after the package, which would break
      // the "./styles.css" entry in the exports map.
      cssFileName: 'react-social-feed'
    },
    rollupOptions: {
      // Match subpaths too, so react/jsx-runtime and the optional virtualizer
      // peer are never bundled into dist.
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@tanstack\/react-virtual($|\/)/]
    }
  },
  test: {
    environment: 'jsdom'
  }
});
