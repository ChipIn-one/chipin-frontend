import { expect, test } from 'vitest';

import { PRIVATE_SPA_NAVIGATION_ALLOWLIST } from './private-spa-navigation';

const allowsPrivateFallback = (pathname: string): boolean =>
    PRIVATE_SPA_NAVIGATION_ALLOWLIST.some(pattern => pattern.test(pathname));

test.each([
    // The `home` index (04-5a).
    '/',
    '/dashboard',
    '/solo',
    '/group/123',
    '/group/join/invite',
    '/activity/event',
    '/friends/join/invite',
    '/settings',
    '/oauth/callback',
    '/not-found',
    '/login',
])('keeps offline app shell navigation for private %s', pathname => {
    expect(allowsPrivateFallback(pathname)).toBe(true);
});

test.each([
    '//',
    '/index',
    '/privacy',
    '/terms',
    '/ru/',
    // Removed locales (#609) are redirected by vercel.json, never served the app shell.
    '/pt-br/privacy',
    '/es/unknown',
    '/missing-page',
    '/fr/',
    '/oauthish',
    '/api/users/self',
    '/not-foundish',
    '/loginx',
    '/login/x',
])('never substitutes the app shell for an unknown or asset-like %s', pathname => {
    expect(allowsPrivateFallback(pathname)).toBe(false);
});
