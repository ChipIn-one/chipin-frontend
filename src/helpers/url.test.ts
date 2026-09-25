import { beforeEach, expect, test } from 'vitest';

import { ROUTES } from 'constants/routes';

import { getSocialAuthUrl, resolveOAuthReturnTo } from './url';

const APP_ORIGIN = 'https://chipin.test';

const getReturnToFromSocialAuthUrl = () => {
    const authUrl = new URL(getSocialAuthUrl('google'));
    const callbackUrl = new URL(authUrl.searchParams.get('redirect_to') ?? '');

    return callbackUrl.searchParams.get('returnTo');
};

beforeEach(() => {
    window.history.replaceState({}, '', '/');
});

test('defaults landing-page sign in to the dashboard', () => {
    expect(getReturnToFromSocialAuthUrl()).toBe(ROUTES.DASHBOARD);
});

test('preserves the exact protected route including search and hash', () => {
    window.history.replaceState({}, '', '/group/123?tab=members#balances');

    expect(getReturnToFromSocialAuthUrl()).toBe('/group/123?tab=members#balances');
});

test('keeps a same-origin OAuth return route intact', () => {
    expect(resolveOAuthReturnTo('/activity?filter=mine#latest', APP_ORIGIN)).toBe(
        '/activity?filter=mine#latest',
    );
});

test('rejects cross-origin OAuth return targets', () => {
    expect(resolveOAuthReturnTo('https://example.com/group/123', APP_ORIGIN)).toBe(ROUTES.HOME);
});

test.each([
    ROUTES.OAUTH_CALLBACK,
    `${ROUTES.OAUTH_CALLBACK}/`,
    `${ROUTES.OAUTH_CALLBACK}?code=loop`,
])('prevents OAuth callback redirect loops for %s', returnTo => {
    expect(resolveOAuthReturnTo(returnTo, APP_ORIGIN)).toBe(ROUTES.HOME);
});
