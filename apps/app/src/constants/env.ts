export const ENV_DEV = 'dev' as const;
export const ENV_PROD = 'prod' as const;
export const API_BASE_PATH = '/api/' as const;

// Spec 04 §2.1 (04-2g): `appHostnames` are the hosts the app is served on (the legacy hosts
// `chipin.one`/`dev.chipin.one` until 04-5a); `getEnv()` falls back to them only without
// `VITE_CHIPIN_ENV`. `siteOrigin` (no trailing slash) is the origin of the public site that
// `getSiteOrigin()` returns for links from the app to the site. `siteBaseUrl` is not the site
// origin: it is the app's own URL on the legacy host, the fallback of `getChipInAppUrl()` without
// `window` (SSR).
export const ENV_URLS = {
    [ENV_PROD]: {
        siteBaseUrl: 'https://chipin.one/',
        appHostnames: ['app.chipin.one', 'chipin.one'],
        siteOrigin: 'https://chipin.one',
    },
    [ENV_DEV]: {
        siteBaseUrl: 'https://dev.chipin.one/',
        appHostnames: ['app-dev.chipin.one', 'dev.chipin.one'],
        siteOrigin: 'https://site-dev.chipin.one',
    },
} as const satisfies Record<
    typeof ENV_PROD | typeof ENV_DEV,
    { siteBaseUrl: string; appHostnames: readonly string[]; siteOrigin: string }
>;
