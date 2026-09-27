export const PROD_PWA_APP_NAME = 'ChipIn';
export const DEV_PWA_APP_NAME = 'ChipIn DEV';
export const DEV_PWA_MANIFEST_FILENAME = 'manifest-dev.webmanifest';

export const createPwaManifest = (name: string) => ({
    name,
    short_name: name,
    description: 'Share expenses without stress',
    theme_color: '#3e9b4f',
    display: 'standalone' as const,
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
            purpose: 'maskable' as const,
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
});
