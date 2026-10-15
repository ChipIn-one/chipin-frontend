import { expect, test } from 'vitest';

import { PRIVATE_SPA_NAVIGATION_ALLOWLIST } from './private-spa-navigation';

const allowsPrivateFallback = (pathname: string): boolean =>
    PRIVATE_SPA_NAVIGATION_ALLOWLIST.some(pattern => pattern.test(pathname));

test.each([
    '/dashboard', '/solo', '/group/123', '/group/join/invite',
    '/activity/event', '/friends/join/invite', '/settings', '/oauth/callback', '/not-found',
])('keeps offline app shell navigation for private %s', pathname => {
    expect(allowsPrivateFallback(pathname)).toBe(true);
});

test.each([
    '/', '/privacy', '/terms', '/ru/', '/pt-br/privacy', '/es/unknown',
    '/missing-page', '/fr/', '/oauthish', '/api/users/self', '/not-foundish',
])('never substitutes the private app shell for public or unknown %s', pathname => {
    expect(allowsPrivateFallback(pathname)).toBe(false);
});
