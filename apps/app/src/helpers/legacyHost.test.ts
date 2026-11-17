import { expect, test } from 'vitest';

import {
    getLegacyHostAppDashboardUrl,
    getLegacyHostAppOrigin,
    getLegacyHostAppUrl,
    LEGACY_HOST_APP_ORIGINS,
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
