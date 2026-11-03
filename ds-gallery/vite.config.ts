import { resolve } from 'node:path';

import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const root = resolve(__dirname, '..');

export default defineConfig({
    root: __dirname,
    plugins: [
        // Aliases come from tsconfig.app.json `paths` (via ds-gallery/tsconfig.json, which extends it
        // and also includes the gallery sources).
        tsconfigPaths({ root, projects: [resolve(__dirname, 'tsconfig.json')] }),
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
