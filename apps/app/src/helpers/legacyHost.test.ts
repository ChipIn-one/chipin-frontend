import { afterEach, expect, test } from 'vitest';

import {
    getLegacyHostAppDashboardUrl,
    getLegacyHostAppOrigin,
    getLegacyHostAppUrl,
    getLegacyHostStandaloneAppHost,
    LEGACY_HOST_APP_ORIGINS,
    removeLegacyHostWebAppHeadTags,
} from './legacyHost';
import { LEGACY_SERVICE_WORKER_HOSTNAMES } from './serviceWorkerHost';

// 04-4a2 (spec 04 §4.5 step 1): each legacy host maps to the app host of its environment.
test.each([
    ['chipin.one', 'https://app.chipin.one'],
    ['CHIPIN.ONE', 'https://app.chipin.one'],
    ['chipin.one.', 'https://app.chipin.one'],
    ['dev.chipin.one', 'https://app-dev.chipin.one'],
])('maps the legacy host %s to %s', (hostname, origin) => {
    expect(getLegacyHostAppOrigin(hostname)).toBe(origin);
    expect(getLegacyHostAppDashboardUrl(hostname)).toBe(`${origin}/dashboard`);
});

test.each([
    'app.chipin.one',
    'app-dev.chipin.one',
    'chipin-git-feature-123.vercel.app',
    'localhost',
    'www.chipin.one',
    'issue-199.dev.chipin.one',
    'chipin.one.example.com',
    'constructor',
    '__proto__',
])('is not a legacy host: %s', hostname => {
    expect(getLegacyHostAppOrigin(hostname)).toBeNull();
    expect(getLegacyHostAppDashboardUrl(hostname)).toBeNull();
});

test('covers exactly the hosts that serve the service worker kill-switch', () => {
    expect(Object.keys(LEGACY_HOST_APP_ORIGINS).sort()).toEqual(
        [...LEGACY_SERVICE_WORKER_HOSTNAMES].sort(),
    );
});

// M1 of the 04-4a2 review: `root.tsx` sends the app branch on a legacy host to the same URL there.
test.each([
    ['chipin.one', '/index.html', '?a=1', '#x', 'https://app.chipin.one/index.html?a=1#x'],
    ['dev.chipin.one', '/privacy//', '', '', 'https://app-dev.chipin.one/privacy//'],
])(
    'keeps the path, query and hash of %s%s on the app host',
    (hostname, pathname, search, hash, url) => {
        expect(getLegacyHostAppUrl({ hostname, pathname, search, hash })).toBe(url);
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'has no app URL on the non-legacy host %s',
    hostname => {
        expect(
            getLegacyHostAppUrl({ hostname, pathname: '/dashboard', search: '', hash: '' }),
        ).toBeNull();
    },
);

// #758: an icon installed from a legacy host gets the bare app host of its environment.
test.each([
    ['chipin.one', 'app.chipin.one'],
    ['CHIPIN.ONE.', 'app.chipin.one'],
    ['dev.chipin.one', 'app-dev.chipin.one'],
])('names the app host %s → %s only in standalone mode', (hostname, appHost) => {
    expect(getLegacyHostStandaloneAppHost(hostname, true)).toBe(appHost);
    expect(getLegacyHostStandaloneAppHost(hostname, false)).toBeNull();
});

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'has no standalone app host on the non-legacy host %s, installed or not',
    hostname => {
        expect(getLegacyHostStandaloneAppHost(hostname, true)).toBeNull();
        expect(getLegacyHostStandaloneAppHost(hostname, false)).toBeNull();
    },
);

// The web-app head of `index.html` / `app.html`, plus the manifest link vite-plugin-pwa appends.
const WEB_APP_HEAD = `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>ChipIn</title>
    <link rel="manifest" href="/manifest.webmanifest">
`;

const WEB_APP_SELECTORS = [
    'link[rel="manifest"]',
    'meta[name="mobile-web-app-capable"]',
    'meta[name="apple-mobile-web-app-capable"]',
    'meta[name="apple-mobile-web-app-status-bar-style"]',
];
const KEPT_SELECTORS = [
    'meta[charset]',
    'meta[name="viewport"]',
    'link[rel="icon"][href="/favicon.ico"]',
    'link[rel="icon"][href="/favicon.svg"]',
    'link[rel="apple-touch-icon"]',
    'title',
];

afterEach(() => {
    document.head.innerHTML = '';
});

test.each(['chipin.one', 'dev.chipin.one', 'Chipin.One.'])(
    'removes the manifest and the web-app metas on the legacy host %s, keeping the icons',
    hostname => {
        document.head.innerHTML = WEB_APP_HEAD;

        removeLegacyHostWebAppHeadTags(document, hostname);

        for (const selector of WEB_APP_SELECTORS) {
            expect(document.head.querySelector(selector)).toBeNull();
        }
        for (const selector of KEPT_SELECTORS) {
            expect(document.head.querySelector(selector)).not.toBeNull();
        }
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'keeps the whole web-app head on %s',
    hostname => {
        document.head.innerHTML = WEB_APP_HEAD;
        const before = document.head.innerHTML;

        removeLegacyHostWebAppHeadTags(document, hostname);

        expect(document.head.innerHTML).toBe(before);
        expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(2);
        for (const selector of WEB_APP_SELECTORS) {
            expect(document.head.querySelector(selector)).not.toBeNull();
        }
    },
);
