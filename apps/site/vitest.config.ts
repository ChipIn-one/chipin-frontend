import { getViteConfig } from 'astro/config';

// Site unit tests; CI runs them in the site step (`npm run test -w @chipin/site`). Astro's Vite
// config lets a test render `.astro` components with the Container API (home.test.ts).
export default getViteConfig({
    test: {
        include: ['**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**', 'test/fixtures/**'],
        environment: 'node',
        // content.config.test.ts runs a real `astro build` of a fixture.
        testTimeout: 120_000,
    },
});
