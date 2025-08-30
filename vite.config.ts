import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/

export default defineConfig({
    plugins: [
        svgr(),
        react(),
        tsconfigPaths(),
        VitePWA({
            registerType: 'prompt', // or autoUpdate
            injectRegister: false,

            manifest: {
                name: 'ChipIn',
                short_name: 'ChipIn',
                description: 'Share expenses without stress',
                theme_color: '#3e9b4f',
                display: 'standalone',
            },

            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: false,
            },

            devOptions: {
                enabled: false,
                navigateFallback: 'index.html',
                suppressWarnings: true,
                type: 'module',
            },
        }),
    ],
});
