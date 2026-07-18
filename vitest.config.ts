import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        clearMocks: true,
        restoreMocks: true,
    },
});
