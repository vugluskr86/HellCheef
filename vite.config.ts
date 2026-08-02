import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages деплоит из docs/, поэтому билд кладём туда же
  build: {
    outDir: 'docs',
    target: 'es2020',
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Репозиторий называется HellCheef → Pages будет на /HellCheef/
  base: '/HellCheef/',
});