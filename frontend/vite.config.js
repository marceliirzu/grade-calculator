import { defineConfig } from 'vite';

// GitHub Pages serves a project site from /<repo>/, so asset URLs must be prefixed. A custom
// domain (calcyourgpa.com) serves from the root instead and needs '/'. The deploy workflow
// sets VITE_BASE accordingly rather than baking one of them in, because getting this wrong
// produces a page that loads but silently 404s every script.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,

  build: {
    outDir: 'dist',
    sourcemap: true,
    // Fail the build rather than shipping a chunk large enough to hurt first paint on mobile,
    // which is where most students open this.
    chunkSizeWarningLimit: 600,
  },

  server: {
    port: 5173,
    // The API runs on 5000 locally. Proxying keeps the browser on one origin in development,
    // so a CORS misconfiguration surfaces in staging rather than only in production.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
