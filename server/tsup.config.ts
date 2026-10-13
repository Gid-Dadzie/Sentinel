import { defineConfig } from 'tsup';

export default defineConfig({
  // index.ts runs a standalone server; vercel.ts exports the app for Vercel's functions.
  entry: ['src/index.ts', 'src/vercel.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  // The engine is TypeScript source in the workspace, so it is bundled in;
  // everything from npm stays an ordinary runtime dependency.
  noExternal: ['@sentinel/engine'],
});
