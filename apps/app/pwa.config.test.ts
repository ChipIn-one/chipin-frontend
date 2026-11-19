// Spec 04 §2.11 (04-2d): the table of the VitePWA options and the common options.
import { describe, expect, test } from 'vitest';

import { APP_SHELL, buildPwaOptions } from './pwa.config.ts';
import { addPublicDirectoryAliases } from './scripts/prerender-before-workbox.mjs';
import { PRIVATE_SPA_NAVIGATION_ALLOWLIST } from './scripts/private-spa-navigation.ts';

const options = buildPwaOptions({ appName: 'ChipIn' });
const { manifest, workbox } = options;

describe('buildPwaOptions: the table of spec 04 §2.11', () => {
    test('the worker is dist/sw.js at /sw.js with scope /', () => {
        expect(options.outDir).toBe('dist');
        expect(options.buildBase).toBe('/');
        expect(options.scope).toBe('/');
        expect(options.filename).toBe('sw.js');
        expect(options.strategies).toBeUndefined();
        expect(options.srcDir).toBeUndefined();
    });

    test('the manifest is /manifest.webmanifest with start_url, scope and id /', () => {
        expect(options.manifestFilename).toBe('manifest.webmanifest');
        expect(manifest).toMatchObject({ start_url: '/', scope: '/', id: '/' });
    });

    test('the manifest keeps its name, colors and icons', () => {
        expect(manifest).toMatchObject({
            name: 'ChipIn',
            short_name: 'ChipIn',
            description: 'Share expenses without stress',
            theme_color: '#3e9b4f',
            display: 'standalone',
        });
        expect(buildPwaOptions({ appName: 'ChipIn DEV' }).manifest).toMatchObject({
            name: 'ChipIn DEV',
            short_name: 'ChipIn DEV',
        });
        expect(manifest && manifest.icons?.map(icon => icon.src)).toEqual([
            '/pwa-64x64.png',
            '/apple-touch-icon-180x180.png',
            '/pwa-192x192.png',
            '/pwa-512x512.png',
            '/maskable-icon-512x512.png',
            '/favicon.ico',
            '/favicon.svg',
        ]);
        expect(options.includeManifestIcons).toBe(true);
    });

    test('precache patterns, the app shell fallback and its private allowlist', () => {
        expect(APP_SHELL).toBe('app.html');
        expect(workbox?.globPatterns).toEqual(['**/*.{js,css,html,svg,png,webp,ico}']);
        expect(workbox?.navigateFallback).toBe(APP_SHELL);
        expect(workbox?.navigateFallbackAllowlist).toBe(PRIVATE_SPA_NAVIGATION_ALLOWLIST);
    });

    test('the legacy-host kill-switch is never precached (04-4a1)', () => {
        expect(workbox?.globIgnores).toEqual(['**/node_modules/**/*', 'sw-kill.js']);
    });
});

describe('buildPwaOptions: the common options', () => {
    test('the user applies an update: prompt, no injected registration, no skipWaiting', () => {
        expect(options.registerType).toBe('prompt');
        expect(options.injectRegister).toBe(false);
        expect(workbox?.skipWaiting).toBe(false);
        expect(workbox?.clientsClaim).toBe(true);
        expect(workbox?.cleanupOutdatedCaches).toBe(true);
    });

    test('the Workbox runtime is inlined and there is no runtime caching', () => {
        expect(workbox?.inlineWorkboxRuntime).toBe(true);
        expect(workbox?.runtimeCaching).toBeUndefined();
        expect(workbox?.sourcemap).toBe(false);
    });

    test('public directory aliases are added to the precache manifest (until 04-5a)', () => {
        expect(workbox?.manifestTransforms).toEqual([addPublicDirectoryAliases]);
    });

    test('the dev worker stays disabled', () => {
        expect(options.devOptions?.enabled).toBe(false);
    });
});
