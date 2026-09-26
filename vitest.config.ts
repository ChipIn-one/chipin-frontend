import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import react from '@vitejs/plugin-react-swc';

import { resolveAppVersion } from './scripts/version-resolver.mjs';

const appVersion = resolveAppVersion();

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        clearMocks: true,
        restoreMocks: true,
    },
});
