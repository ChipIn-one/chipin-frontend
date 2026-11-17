import { expect, test } from 'vitest';

import {
    getLegacyHostAppDashboardUrl,
    getLegacyHostAppOrigin,
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
