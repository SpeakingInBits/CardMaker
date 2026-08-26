/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works at any GitHub Pages path
  // (e.g. https://<user>.github.io/CardMaker/).
  base: './',
  test: {
    environment: 'node',
    // Keep Playwright e2e specs (e2e/*.spec.ts) out of the vitest run.
    include: ['src/**/*.test.ts'],
  },
});
