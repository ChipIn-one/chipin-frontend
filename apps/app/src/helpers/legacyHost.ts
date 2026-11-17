import { ROUTES } from 'constants/routes';

// Spec 04 §4.1, §4.5 step 1 (04-4a2, D30): while the legacy hosts are in the app project they keep
// the public landing, and everything private moves to the app host of the same environment. The
// landing there signs nobody in: its sign-in CTAs open `<app host>/dashboard`, and the public branch
// skips the session check (no refresh, no `Set-Cookie` on the legacy host). The same map is the
// target of the step-1 redirects in `vercel.json` (checked by `vercel.config.test.js`); its keys are
// the hosts of `LEGACY_SERVICE_WORKER_HOSTNAMES` (checked by `legacyHost.test.ts`).
export const LEGACY_HOST_APP_ORIGINS: Readonly<Record<string, string>> = {
    'chipin.one': 'https://app.chipin.one',
    'dev.chipin.one': 'https://app-dev.chipin.one',
};

const APP_ORIGIN_BY_LEGACY_HOST: ReadonlyMap<string, string> = new Map(
    Object.entries(LEGACY_HOST_APP_ORIGINS),
);

/** The app origin for a legacy host (`chipin.one`, `dev.chipin.one`), else `null`. */
export const getLegacyHostAppOrigin = (hostname: string): string | null =>
    APP_ORIGIN_BY_LEGACY_HOST.get(hostname.toLowerCase().replace(/\.$/, '')) ?? null;

/** `<app host>/dashboard` for a legacy host, else `null`. */
export const getLegacyHostAppDashboardUrl = (hostname: string): string | null => {
    const origin = getLegacyHostAppOrigin(hostname);

    return origin === null ? null : `${origin}${ROUTES.DASHBOARD}`;
};

/**
 * The same URL on the app host for a legacy host, else `null`. The SPA shell must never boot on a
 * legacy host (its session check would refresh and set a cookie there): `root.tsx` replaces the
 * page with this URL whenever it reaches the app branch there (`/index.html`-style URLs, any path
 * the prerender serves that `getPublicRoute` does not know).
 */
export const getLegacyHostAppUrl = ({
    hostname,
    pathname,
    search,
    hash,
}: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'>): string | null => {
    const origin = getLegacyHostAppOrigin(hostname);

    return origin === null ? null : `${origin}${pathname}${search}${hash}`;
};
