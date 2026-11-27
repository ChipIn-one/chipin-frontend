import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ENV_DEV, ENV_PROD } from 'constants/env';
import { ROUTES } from 'constants/routes';

import {
    buildFriendInviteLink,
    buildGroupInviteLink,
    DEFAULT_RETURN_TO,
    getSocialAuthUrl,
    resolveOAuthReturnTo,
} from './url';

const APP_ORIGIN = 'https://chipin.test';

const getReturnToFromSocialAuthUrl = () => {
    const authUrl = new URL(getSocialAuthUrl('google'));
    const callbackUrl = new URL(authUrl.searchParams.get('redirect_to') ?? '');

    return callbackUrl.searchParams.get('returnTo');
};

beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
});

test('defaults landing-page sign in to the dashboard', () => {
    expect(getReturnToFromSocialAuthUrl()).toBe(ROUTES.DASHBOARD);
});

test('preserves the exact protected route including search and hash', () => {
    window.history.replaceState({}, '', '/group/123?tab=members#balances');

    expect(getReturnToFromSocialAuthUrl()).toBe('/group/123?tab=members#balances');
});

// Spec 04 §3.5 (04-2g): invite links open the site's join page on the site origin of the
// environment, never the app origin they were built on.
describe('invite links point to the site join page', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test.each([
        [ENV_PROD, 'https://chipin.one'],
        [ENV_DEV, 'https://site-dev.chipin.one'],
    ])('USR-086 in %s they are built on %s', (env, siteOrigin) => {
        vi.stubEnv('VITE_CHIPIN_ENV', env);

        expect(buildGroupInviteLink({ inviteToken: 'group-token' })).toBe(
            `${siteOrigin}/join/group/group-token`,
        );
        expect(buildFriendInviteLink({ inviteToken: 'friend-token' })).toBe(
            `${siteOrigin}/join/friend/friend-token`,
        );
    });

    test('USR-086 encode the token as one path segment', () => {
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(buildGroupInviteLink({ inviteToken: 'a/b?c#d e' })).toBe(
            'https://chipin.one/join/group/a%2Fb%3Fc%23d%20e',
        );
        expect(buildFriendInviteLink({ inviteToken: '../x' })).toBe(
            'https://chipin.one/join/friend/..%2Fx',
        );
    });
});

// 04-2g: the landing check compares the pathname with the relative root path; the absolute
// `SITE_PATHS` never match a pathname.
test.each(['/', '/?utm_source=x', '/#top'])(
    'a sign-in started on the landing %s returns to the dashboard',
    url => {
        window.history.replaceState({}, '', url);

        expect(getReturnToFromSocialAuthUrl()).toBe(DEFAULT_RETURN_TO);
    },
);

test.each(['/ru/', '/privacy', '/group/1'])('a sign-in started on %s keeps its own path', url => {
    window.history.replaceState({}, '', url);

    expect(getReturnToFromSocialAuthUrl()).toBe(url);
});

test('preserves a friend invite route through OAuth sign in', () => {
    window.history.replaceState({}, '', '/friends/join/friend-token');

    expect(getReturnToFromSocialAuthUrl()).toBe('/friends/join/friend-token');
});

test('keeps a same-origin OAuth return route intact', () => {
    expect(resolveOAuthReturnTo('/activity?filter=mine#latest', APP_ORIGIN)).toBe(
        '/activity?filter=mine#latest',
    );
});

test('rejects cross-origin OAuth return targets', () => {
    expect(resolveOAuthReturnTo('https://example.com/group/123', APP_ORIGIN)).toBe(
        DEFAULT_RETURN_TO,
    );
});

test.each([
    ROUTES.OAUTH_CALLBACK,
    `${ROUTES.OAUTH_CALLBACK}/`,
    `${ROUTES.OAUTH_CALLBACK}?code=loop`,
])('prevents OAuth callback redirect loops for %s', returnTo => {
    expect(resolveOAuthReturnTo(returnTo, APP_ORIGIN)).toBe(DEFAULT_RETURN_TO);
});

describe('returnTo is a same-origin app path', () => {
    test('AUTH-072 the default returnTo is the dashboard', () => {
        expect(DEFAULT_RETURN_TO).toBe('/dashboard');
        expect(resolveOAuthReturnTo(null, APP_ORIGIN)).toBe('/dashboard');
        expect(resolveOAuthReturnTo('', APP_ORIGIN)).toBe('/dashboard');
    });

    test('AUTH-072 keeps a join path with its invite token', () => {
        expect(resolveOAuthReturnTo('/group/join/tok-123_AZ', APP_ORIGIN)).toBe(
            '/group/join/tok-123_AZ',
        );
        expect(resolveOAuthReturnTo('/friends/join/tok?x=1', APP_ORIGIN)).toBe(
            '/friends/join/tok?x=1',
        );
    });

    test('AUTH-072 caps the length of returnTo at 2048 characters', () => {
        const longest = `/group/${'a'.repeat(2048 - '/group/'.length)}`;

        expect(resolveOAuthReturnTo(longest, APP_ORIGIN)).toBe(longest);
        expect(resolveOAuthReturnTo(`${longest}a`, APP_ORIGIN)).toBe(DEFAULT_RETURN_TO);
    });

    test.each([
        ['an absolute URL', 'https://evil.example/group/1'],
        ['a same-origin absolute URL', `${APP_ORIGIN}/group/1`],
        ['a relative path', 'group/1'],
        ['a protocol-relative URL', '//evil.example'],
        ['a protocol-relative URL with a path', '//evil.example/group/1'],
        ['a backslash after the slash', '/\\evil.example'],
        ['a double backslash', '\\\\evil.example'],
        ['a backslash later in the path', '/group\\..\\evil'],
        ['an encoded double slash', '/%2F%2Fevil.example'],
        ['an encoded double slash without the leading slash', '%2F%2Fevil.example'],
        ['an encoded slash after the slash', '/%2Fevil.example'],
        ['an encoded backslash', '/%5Cevil.example'],
        ['a double-encoded double slash', '/%252F%252Fevil.example'],
        ['a malformed escape', '/%E0%A4%A'],
        ['javascript:', 'javascript:alert(1)'],
        ['JavaScript: in mixed case', 'JaVaScRiPt:alert(1)'],
        ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
        ['a leading space', ' /group/1'],
        ['a leading tab', '\t//evil.example'],
        ['a tab inside', '/\t/evil.example'],
        ['a newline inside', '/\n/evil.example'],
        ['an encoded tab', '/%09/evil.example'],
        ['a NUL', '/\u0000/evil.example'],
        ['the login page', '/login'],
        ['the login page with a query', '/login?returnTo=%2Fdashboard'],
        ['the login page with a trailing slash', '/login/'],
        ['the login page in another case', '/LOGIN'],
        ['the login page encoded', '/%6Cogin'],
        ['the OAuth callback in another case', '/OAuth/Callback?code=x'],
        ['a dot segment that normalizes to //host', '/.//evil.com'],
        ['a parent segment that normalizes to //host', '/a/..//evil.com'],
        ['encoded parent segments that normalize to //host', '/%2e%2e/%2e%2e//evil.com'],
        ['a returnTo longer than 2048 characters', `/group/${'a'.repeat(2048)}`],
    ])('AUTH-072 rejects %s', (_name, returnTo) => {
        expect(resolveOAuthReturnTo(returnTo, APP_ORIGIN)).toBe(DEFAULT_RETURN_TO);
    });
});

describe('the sign-in started from /login', () => {
    test('AUTH-074 the callback returns to the given returnTo, not to /login', () => {
        window.history.replaceState({}, '', '/login?returnTo=%2Fgroup%2Fjoin%2Ftok');
        const authUrl = new URL(getSocialAuthUrl('google', { returnTo: '/group/join/tok' }));
        const callbackUrl = new URL(authUrl.searchParams.get('redirect_to') ?? '');

        expect(callbackUrl.pathname).toBe(ROUTES.OAUTH_CALLBACK);
        expect(callbackUrl.searchParams.get('returnTo')).toBe('/group/join/tok');
    });

    test('AUTH-076 a supported ?locale is the registration locale', () => {
        vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
        window.history.replaceState({}, '', '/login?locale=ru');

        expect(
            new URL(getSocialAuthUrl('google', { locale: 'ru' })).searchParams.get('locale'),
        ).toBe('ru');
    });

    test.each(['ru-RU', 'RU', 'xx', '../ru', ''])(
        'AUTH-076 an unsupported ?locale %j falls back to the browser language',
        locale => {
            vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
            window.history.replaceState({}, '', '/login');

            expect(new URL(getSocialAuthUrl('google', { locale })).searchParams.get('locale')).toBe(
                'en',
            );
        },
    );
});

test('04-5b: the app path is never a locale, Google OAuth takes the browser language', () => {
    window.history.replaceState({}, '', '/ru/privacy');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    expect(new URL(getSocialAuthUrl('google')).searchParams.get('locale')).toBe('en');
});

test('a sign-up without ?locale uses the supported browser language', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ja-JP', 'ru-RU']);
    expect(new URL(getSocialAuthUrl('google')).searchParams.get('locale')).toBe('ru');
});

test('unsupported browser language defaults new signup to English', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    expect(new URL(getSocialAuthUrl('google')).searchParams.get('locale')).toBe('en');
});
