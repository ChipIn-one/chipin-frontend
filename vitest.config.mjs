import { defineConfig } from 'vitest/config';

// Repository-level tests (scripts/, config/, packages/); the app tests run in apps/app
// (`npm run test:full` runs both). Vite transforms the package sources (`import.meta.glob`).
export default defineConfig({
    test: {
        include: ['scripts/**/*.test.{mjs,ts}', 'config/**/*.test.mjs', 'packages/**/*.test.ts'],
        environment: 'node',
        // These suites start ESLint, tsc and git; the first ESLint lint of a file builds the
        // resolver and config (5-7 s on a busy machine, over the 5 s default).
        testTimeout: 20_000,
        clearMocks: true,
        restoreMocks: true,
    },
});
