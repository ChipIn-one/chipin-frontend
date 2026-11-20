import { defineConfig } from 'vitest/config';

// Site unit tests; CI runs them in the site step (`npm run test -w @chipin/site`).
export default defineConfig({
    test: {
        include: ['**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**', 'test/fixtures/**'],
        environment: 'node',
        // content.config.test.ts runs a real `astro build` of a fixture.
        testTimeout: 120_000,
    },
});
