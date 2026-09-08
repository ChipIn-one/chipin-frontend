import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react-swc';

import { resolveAppVersion } from './scripts/version-resolver.mjs';

// https://vite.dev/config/

type SentryEnvironment = 'ci' | 'development' | 'local' | 'preview' | 'production';

interface SentryBuildConfig {
    enabled: boolean;
    environment: SentryEnvironment;
}

interface SentryUploadConfig {
    authToken: string;
    org: string;
    project: string;
}

const resolveSentryBuildConfig = (env: Record<string, string>): SentryBuildConfig => {
    const chipInEnvironment = env.VITE_CHIPIN_ENV;
    const vercelEnvironment = env.VERCEL_ENV;

    if (
        chipInEnvironment !== undefined &&
        chipInEnvironment !== 'dev' &&
        chipInEnvironment !== 'prod'
    ) {
        throw new Error(`Unsupported ChipIn environment: ${chipInEnvironment}`);
    }

    if (vercelEnvironment === 'preview') {
        if (chipInEnvironment !== 'dev') {
            throw new Error(
                'VITE_CHIPIN_ENV must be "dev" for a Vercel preview build',
            );
        }

        return { enabled: true, environment: 'preview' };
    }

    if (vercelEnvironment === 'development') {
        return { enabled: false, environment: 'development' };
    }

    if (vercelEnvironment === 'production') {
        if (chipInEnvironment === 'prod') {
            return { enabled: true, environment: 'production' };
        }

        if (chipInEnvironment === 'dev') {
            return { enabled: true, environment: 'development' };
        }

        throw new Error('VITE_CHIPIN_ENV is required for a Vercel production build');
    }

    if (vercelEnvironment !== undefined) {
        throw new Error(`Unsupported Vercel environment: ${vercelEnvironment}`);
    }

    return {
        enabled: false,
        environment: env.CI === 'true' ? 'ci' : 'local',
    };
};

const resolveSentryUploadConfig = (
    env: Record<string, string>,
    sentryBuildConfig: SentryBuildConfig,
): SentryUploadConfig | null => {
    if (env.VERCEL !== '1' || !sentryBuildConfig.enabled) {
        return null;
    }

    const authToken = env.SENTRY_AUTH_TOKEN;
    const org = env.SENTRY_ORG;
    const project = env.SENTRY_PROJECT;

    if (!authToken || !org || !project) {
        throw new Error(
            'Sentry source map upload requires SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT',
        );
    }

    return {
        authToken,
        org,
        project,
    };
};

const appVersion = resolveAppVersion();

export default defineConfig(({ mode }) => {
    const buildEnvironment = loadEnv(mode, '.', '');
    const sentryBuildConfig = resolveSentryBuildConfig(buildEnvironment);
    const sentryUploadConfig = resolveSentryUploadConfig(
        buildEnvironment,
        sentryBuildConfig,
    );

    return {
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
            'import.meta.env.VITE_SENTRY_ENABLED': JSON.stringify(
                sentryBuildConfig.enabled,
            ),
            'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
                sentryBuildConfig.environment,
            ),
        },
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
                    sourcemap: false,
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
            ...(sentryUploadConfig
                ? [
                      sentryVitePlugin({
                          authToken: sentryUploadConfig.authToken,
                          org: sentryUploadConfig.org,
                          project: sentryUploadConfig.project,
                          telemetry: false,
                          release: {
                              name: appVersion,
                              inject: false,
                              create: true,
                              finalize: true,
                              setCommits: false,
                          },
                          sourcemaps: {
                              assets: './dist/**',
                              filesToDeleteAfterUpload: './dist/**/*.map',
                          },
                      }),
                  ]
                : []),
        ],

        build: {
            sourcemap: 'hidden',
            rollupOptions: {
                output: {
                    manualChunks: {
                        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                        'vendor-radix': ['@radix-ui/themes'],
                        'vendor-sentry': ['@sentry/react'],
                        'vendor-styled': ['styled-components'],
                        'vendor-i18n': ['i18next', 'react-i18next'],
                        'vendor-misc': [
                            'axios',
                            'dexie',
                            'dexie-react-hooks',
                            'zustand',
                        ],
                    },
                },
            },
        },
    };
});
