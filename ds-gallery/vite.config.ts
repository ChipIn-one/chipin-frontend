import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

import react from '@vitejs/plugin-react-swc';

const root = resolve(__dirname, '..');

export default defineConfig({
    root: __dirname,
    plugins: [tsconfigPaths({ root, projects: [resolve(root, 'tsconfig.app.json')] }), svgr(), react()],
    define: {
        'import.meta.env.VITE_CHIPIN_ENV': JSON.stringify('dev'),
        'import.meta.env.VITE_SENTRY_ENABLED': 'false',
    },
    resolve: { alias: ['api','assets','basics','bootstrap','components','constants','features','helpers','hooks','i18n','pages','public-routes','store','styles','types'].map(d => ({ find: new RegExp(`^${d}(?=/|$)`), replacement: resolve(root, 'src', d) })) },
    build: {
        outDir: resolve(root, 'node_modules/.cache/ds-gallery'),
        emptyOutDir: true,
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: { output: { inlineDynamicImports: true, format: 'iife', entryFileNames: 'gallery.js', assetFileNames: 'gallery.[ext]' } },
    },
});
