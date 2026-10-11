/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the app from /Sentinel/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // In API mode the browser calls /api on this dev server, which forwards to the API.
  // Same origin, so the session cookie needs no CORS setup.
  server: {
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:4000' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // The engine package and the server run their own tests.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
