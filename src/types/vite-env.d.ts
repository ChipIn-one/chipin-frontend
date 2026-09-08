/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-svgr/client" />

type ViteChipInEnv = 'dev' | 'prod';
type ViteSentryEnvironment = 'ci' | 'development' | 'local' | 'preview' | 'production';

interface ImportMetaEnv {
    readonly VITE_CHIPIN_ENV?: ViteChipInEnv;
    readonly VITE_SENTRY_ENABLED: boolean;
    readonly VITE_SENTRY_ENVIRONMENT: ViteSentryEnvironment;
}
