import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { configDefaults, defineConfig } from 'vitest/config';

import { resolveAppVersion } from '../../scripts/version-resolver.mjs';

const appVersion = resolveAppVersion();

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        // Playwright specs run only through `npm run test:e2e` (playwright.config.ts); the pure
        // e2e support modules keep their `*.test.ts` unit tests here.
        exclude: [...configDefaults.exclude, 'e2e/**/*.spec.ts'],
        clearMocks: true,
        restoreMocks: true,
    },
});
