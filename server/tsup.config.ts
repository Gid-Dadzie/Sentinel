import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  // The engine is TypeScript source in the workspace, so it is bundled in;
  // everything from npm stays an ordinary runtime dependency.
  noExternal: ['@sentinel/engine'],
});
