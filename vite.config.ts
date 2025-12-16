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
                // DEEP LINKING PARAMS
                start_url: '/',
                scope: '/',
                id: '/',

                icons: [
                    {
                        src: '/pwa-64x64.png',
                        sizes: '64x64',
                        type: 'image/png',
                    },
                    {
                        src: '/apple-touch-icon-180x180.png',
                        sizes: '180x180',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/maskable-icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: '/favicon.ico',
                        sizes: '48x48',
                        type: 'image/x-icon',
                    },
                    {
                        src: '/favicon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                    },
                ],
            },
            includeManifestIcons: true,

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
