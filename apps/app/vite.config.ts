import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

import { resolveAppVersionInfo } from '../../scripts/version-resolver.mjs';

import { buildPwaOptions } from './pwa.config.ts';
import { brandPlugin, themeInitPlugin } from './scripts/brand-plugin.ts';
import { shouldUploadSourcemaps } from './scripts/sentry-sourcemaps.ts';
import { swAppPlugin } from './scripts/sw-app-plugin.ts';

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
            throw new Error('VITE_CHIPIN_ENV must be "dev" for a Vercel preview build');
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
    isRelease: boolean,
): SentryUploadConfig | null => {
    // Only Vercel production builds upload; preview builds skip it even when SENTRY_AUTH_TOKEN is set (#575).
    // Only a build of a commit with a release tag vX.Y.Z creates a Sentry release and uploads source maps;
    // the first, pre-tag Production build stays untagged and uploads nothing (ChipIn-one/.github#172).
    if (!shouldUploadSourcemaps(env) || !sentryBuildConfig.enabled || !isRelease) {
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

const appVersionInfo = resolveAppVersionInfo();
const appVersion = appVersionInfo.version;

export default defineConfig(({ command, mode }) => {
    const buildEnvironment = loadEnv(mode, '.', '');
    const pwaAppName = buildEnvironment.VITE_CHIPIN_ENV === 'dev' ? 'ChipIn DEV' : 'ChipIn';
    const sentryBuildConfig = resolveSentryBuildConfig(buildEnvironment);
    const sentryUploadConfig = resolveSentryUploadConfig(
        buildEnvironment,
        sentryBuildConfig,
        appVersionInfo.isRelease,
    );
    const apiProxy = {
        '/api': {
            target: 'https://api-dev.chipin.one',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
    };

    return {
        // The app is served from the host root (spec 04 §2.11: `buildBase` and the SW scope are `/`).
        base: '/',
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
            'import.meta.env.VITE_SENTRY_ENABLED': JSON.stringify(sentryBuildConfig.enabled),
            'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
                sentryBuildConfig.environment,
            ),
        },
        // CSS Modules (spec 05 §3): readable class names in dev, short hashes in the build.
        css: {
            modules: {
                localsConvention: 'camelCaseOnly',
                generateScopedName: command === 'serve' ? '[name]__[local]' : '[hash:base64:6]',
            },
        },
        plugins: [
            svgr(),
            react(),
            tsconfigPaths(),
            // favicon.svg from @chipin/tokens at /favicon.svg, <meta name="theme-color"> (05-2b).
            brandPlugin(),
            VitePWA(buildPwaOptions({ appName: pwaAppName })),
            // After VitePWA: renames dist/sw.js to dist/sw-app.js once the worker is written (04-4a1).
            swAppPlugin(),
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
                              // Rolldown emits its tiny runtime helper chunk without a source map,
                              // so Sentry cannot resolve a reference for it (#575).
                              ignore: ['**/node_modules/**', './dist/assets/rolldown-runtime-*.js'],
                              filesToDeleteAfterUpload: './dist/**/*.map',
                          },
                      }),
                  ]
                : []),
            // The anti-FOUC theme script becomes the first element of `<head>` in app.html: its hook
            // runs late (`order: 'post'`), and no hook after it prepends to `<head>`.
            themeInitPlugin(),
        ],

        server: {
            proxy: apiProxy,
        },
        preview: {
            proxy: apiProxy,
        },

        build: {
            // Emit hidden source maps only for the Sentry upload, which deletes them from dist afterwards.
            sourcemap: sentryUploadConfig ? 'hidden' : false,
            rolldownOptions: {
                input: ['index.html', 'app.html'],
                output: {
                    // Keep long-lived framework dependencies cacheable here.
                    // Application areas are split by route/modal dynamic imports instead of
                    // forced manual groups so navigation does not download unrelated features.
                    codeSplitting: {
                        groups: [
                            {
                                name: 'vendor-react',
                                test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                            },
                            {
                                name: 'vendor-radix',
                                test: /node_modules[\\/]@radix-ui[\\/]themes[\\/]/,
                            },
                            {
                                name: 'vendor-sentry',
                                test: /node_modules[\\/]@sentry[\\/]react[\\/]/,
                            },
                            {
                                name: 'vendor-styled',
                                test: /node_modules[\\/]styled-components[\\/]/,
                            },
                            {
                                name: 'vendor-i18n',
                                test: /node_modules[\\/](?:i18next|react-i18next)[\\/]/,
                            },
                            {
                                name: 'vendor-misc',
                                test: /node_modules[\\/](?:axios|zustand)[\\/]/,
                            },
                        ],
                    },
                },
            },
        },
    };
});
