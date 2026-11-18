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

/**
 * The bare app host (`app.chipin.one`, `app-dev.chipin.one`) when the landing runs as an installed
 * web app on a legacy host, else `null` (#758). Such an icon was installed from the legacy host
 * before step 1; its scope is that host, so every way to the app host (a sign-in CTA, the session
 * handoff) opens an in-app sheet that never hands the session to the icon. The landing then shows
 * a notice instead: open the app host in the browser and add it to the Home Screen again.
 */
export const getLegacyHostStandaloneAppHost = (
    hostname: string,
    isStandalone: boolean,
): string | null => {
    const origin = isStandalone ? getLegacyHostAppOrigin(hostname) : null;

    return origin === null ? null : new URL(origin).host;
};

// #758: the HTML is shared by every host, so its web-app tags (`index.html`, `app.html` and the
// prerendered public pages built from `index.html`) reach the legacy hosts too. There they would
// keep the landing installable as an app (iOS reads the DOM when the user adds it to the Home
// Screen), so `root.tsx` removes them before anything renders. The CSP (`script-src 'self'`) rules
// out an inline script in the HTML. The icons (`apple-touch-icon`, favicons) stay: they only make
// a bookmark look right. `vercel.json` also stops serving `/manifest.webmanifest` there.
const LEGACY_HOST_WEB_APP_HEAD_SELECTOR = [
    'link[rel~="manifest" i]',
    'meta[name="mobile-web-app-capable" i]',
    'meta[name="apple-mobile-web-app-capable" i]',
    'meta[name="apple-mobile-web-app-status-bar-style" i]',
].join(', ');

/** Removes the manifest link and the web-app metas on a legacy host; no-op on every other host. */
export const removeLegacyHostWebAppHeadTags = (doc: Document, hostname: string): void => {
    if (getLegacyHostAppOrigin(hostname) === null) {
        return;
    }

    doc.head.querySelectorAll(LEGACY_HOST_WEB_APP_HEAD_SELECTOR).forEach(element => {
        element.remove();
    });
};
