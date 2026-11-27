export const ENV_DEV = 'dev' as const;
export const ENV_PROD = 'prod' as const;
export const API_BASE_PATH = '/api/' as const;

// Spec 04 §2.1 (04-2g): `appHostnames` are the hosts the app is served on; `getEnv()` falls back
// to them only without `VITE_CHIPIN_ENV`. `siteOrigin` (no trailing slash) is the origin of the
// public site that `getSiteOrigin()` returns for links from the app to the site. The app URL is
// always the current origin (`getChipInAppUrl()`): the app runs only in a browser.
export const ENV_URLS = {
    [ENV_PROD]: {
        appHostnames: ['app.chipin.one'],
        siteOrigin: 'https://chipin.one',
    },
    [ENV_DEV]: {
        appHostnames: ['app-dev.chipin.one'],
        siteOrigin: 'https://site-dev.chipin.one',
    },
} as const satisfies Record<
    typeof ENV_PROD | typeof ENV_DEV,
    { appHostnames: readonly string[]; siteOrigin: string }
>;
