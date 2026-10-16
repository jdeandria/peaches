/**
 * Contract tests for the Firestore repositories, run against the local
 * Firestore emulator rather than through `ng test`:
 *
 *   firebase emulators:exec --only firestore --project demo-peaches \
 *     "vitest run --config vitest.firestore.config.mts"
 *
 * `emulators:exec` sets FIRESTORE_EMULATOR_HOST; without it the suites skip.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The shared lifecycle suite uses describe/it/expect as globals, like ng test.
    globals: true,
    include: ['src/app/data/firestore/**/*.spec.ts'],
    // Emulator round trips are slow compared to unit tests, and the
    // suites share one emulator database, so run them one file at a time.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
