import { resolve } from 'node:path';

import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const root = resolve(import.meta.dirname, '..');

export default defineConfig({
    root: import.meta.dirname,
    plugins: [
        // Aliases come from tsconfig.app.json `paths`; that project also includes the gallery sources.
        tsconfigPaths({ root, projects: [resolve(root, 'tsconfig.app.json')] }),
        svgr(),
        react(),
    ],
    define: {
        'import.meta.env.VITE_CHIPIN_ENV': JSON.stringify('dev'),
        'import.meta.env.VITE_SENTRY_ENABLED': 'false',
    },
    build: {
        outDir: resolve(root, 'node_modules/.cache/ds-gallery'),
        emptyOutDir: true,
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                format: 'iife',
                entryFileNames: 'gallery.js',
                assetFileNames: 'gallery.[ext]',
            },
        },
    },
});
