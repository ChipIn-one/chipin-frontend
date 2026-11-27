// The VitePWA options of the app (spec 04 §2.11, 04-2d): one pure function, so the table of §2.11 is
// checked by `pwa.config.test.ts` without a build. Checked against `vite-plugin-pwa@1.3.0`
// (`swDest = outDir/filename`, `globDirectory = outDir`, the registration path and the
// `<link rel="manifest">` are `buildBase` + `filename`/`manifestFilename`) and `workbox-build@7`.
import { BRAND_COLORS } from '@chipin/tokens/theme';
import type { VitePWAOptions } from 'vite-plugin-pwa';

import {
    addPublicDirectoryAliases,
    runPrerenderPublic,
} from './scripts/prerender-before-workbox.mjs';
import { PRIVATE_SPA_NAVIGATION_ALLOWLIST } from './scripts/private-spa-navigation.ts';

/** The SW navigation fallback: the noindex SPA shell (04-5a → `index.html`). */
export const APP_SHELL = 'app.html';

interface PwaOptionsInput {
    /** `ChipIn DEV` on the dev environment, `ChipIn` elsewhere. */
    appName: string;
}

export const buildPwaOptions = ({ appName }: PwaOptionsInput): Partial<VitePWAOptions> => ({
    // Run SSG after Vite writes client assets, before Workbox scans dist.
    // This prevents missing localized pages and stale root HTML revisions.
    integration: {
        beforeBuildServiceWorker: runPrerenderPublic,
    },
    // `src/app/pwa/ServiceWorkerManager.tsx` registers the worker (`useRegisterSW`) and asks the
    // user before an update: nothing is injected into the HTML.
    registerType: 'prompt',
    injectRegister: false,
    // Where `sw.js` is written (also the Workbox `globDirectory`).
    outDir: 'dist',
    // The registration path and `<link rel="manifest">`: `/sw.js`, `/manifest.webmanifest`. From
    // 04-4a1 until 04-5a the built `dist/sw.js` is renamed to `dist/sw-app.js` by `swAppPlugin`
    // and served at `/sw.js` by the host rewrite of `vercel.json`; `filename` stays `sw.js`.
    buildBase: '/',
    scope: '/',
    filename: 'sw.js',
    manifestFilename: 'manifest.webmanifest',

    manifest: {
        name: appName,
        short_name: appName,
        description: 'Share expenses without stress',
        // `BRAND_COLORS` of @chipin/tokens (D23/D31); the interim PWA values (owner, 2026-11-20).
        theme_color: BRAND_COLORS.pwaThemeColor,
        background_color: BRAND_COLORS.pwaBackgroundColor,
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
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
        // Canonical public URLs omit index.html and often the slash.
        // Precache both URL variants so offline navigation resolves (until 04-5a, while prerender
        // exists).
        manifestTransforms: [addPublicDirectoryAliases],
        // Serve the noindex SPA shell for service-worker navigation fallback.
        navigateFallback: APP_SHELL,
        // Only explicitly private SPA paths may use offline app.html.
        // All public URLs use exact precache entries, and unknown URLs retain 404.
        navigateFallbackAllowlist: PRIVATE_SPA_NAVIGATION_ALLOWLIST,
        sourcemap: false,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // The user (or the forced-update rule) applies a waiting worker: `SKIP_WAITING` message.
        skipWaiting: false,
        // No `workbox-*.js` next to the worker: the runtime is inside `sw.js`.
        inlineWorkboxRuntime: true,
        // No `runtimeCaching`: there is no API cache in the SW (that is the TanStack persister).
    },

    devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
    },
});
