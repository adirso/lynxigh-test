import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./test/helpers/env-setup.ts'],
    // Integration tests share one real Postgres DB and reset it via a global
    // resetDb() (deleteMany across tables) in beforeEach. Running test files
    // in parallel workers races that reset against in-flight requests in other
    // files (e.g. a user created in one file gets deleted by another file's
    // resetDb before the first file finishes using it). Keep file execution
    // sequential to make the shared-DB tests deterministic.
    fileParallelism: false,
  },
});
