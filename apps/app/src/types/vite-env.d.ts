/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-svgr/client" />

type ViteChipInEnv = 'dev' | 'prod';
type ViteSentryEnvironment = 'ci' | 'development' | 'local' | 'preview' | 'production';

interface ImportMetaEnv {
    readonly VITE_CHIPIN_ENV?: ViteChipInEnv;
    /** Offline expense writes through the outbox (spec 03 §2.7): on only when exactly `true`. */
    readonly VITE_FEATURE_OFFLINE_WRITES?: string;
    /**
     * The blocking "App update required" screen (spec 04 §2.11 item 4): on only when exactly
     * `true`; off until BE-03-5 (`MIN_CLIENT_VERSION` → 426) ships.
     */
    readonly VITE_FEATURE_UPDATE_REQUIRED?: string;
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_SENTRY_ENABLED: boolean;
    readonly VITE_SENTRY_ENVIRONMENT: ViteSentryEnvironment;
}
