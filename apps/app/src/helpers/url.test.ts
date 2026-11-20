import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ROUTES } from 'constants/routes';

import {
    buildFriendInviteLink,
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

test('builds personal friend invite links on the canonical route', () => {
    expect(buildFriendInviteLink({ inviteToken: 'friend-token' })).toContain(
        '/friends/join/friend-token',
    );
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

describe('04-2f login: returnTo is a same-origin app path', () => {
    test('04-2f login: the default returnTo is the dashboard', () => {
        expect(DEFAULT_RETURN_TO).toBe('/dashboard');
        expect(resolveOAuthReturnTo(null, APP_ORIGIN)).toBe('/dashboard');
        expect(resolveOAuthReturnTo('', APP_ORIGIN)).toBe('/dashboard');
    });

    test('04-2f login: keeps a join path with its invite token', () => {
        expect(resolveOAuthReturnTo('/group/join/tok-123_AZ', APP_ORIGIN)).toBe(
            '/group/join/tok-123_AZ',
        );
        expect(resolveOAuthReturnTo('/friends/join/tok?x=1', APP_ORIGIN)).toBe(
            '/friends/join/tok?x=1',
        );
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
    ])('04-2f login: rejects %s', (_name, returnTo) => {
        expect(resolveOAuthReturnTo(returnTo, APP_ORIGIN)).toBe(DEFAULT_RETURN_TO);
    });
});

describe('04-2f login: the sign-in started from /login', () => {
    test('04-2f login: the callback returns to the given returnTo, not to /login', () => {
        window.history.replaceState({}, '', '/login?returnTo=%2Fgroup%2Fjoin%2Ftok');
        const authUrl = new URL(getSocialAuthUrl('google', { returnTo: '/group/join/tok' }));
        const callbackUrl = new URL(authUrl.searchParams.get('redirect_to') ?? '');

        expect(callbackUrl.pathname).toBe(ROUTES.OAUTH_CALLBACK);
        expect(callbackUrl.searchParams.get('returnTo')).toBe('/group/join/tok');
    });

    test('04-2f login: a supported ?locale is the registration locale', () => {
        vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
        window.history.replaceState({}, '', '/login?locale=ru');

        expect(
            new URL(getSocialAuthUrl('google', { locale: 'ru' })).searchParams.get('locale'),
        ).toBe('ru');
    });

    test.each(['ru-RU', 'RU', 'xx', '../ru', ''])(
        '04-2f login: an unsupported ?locale %j falls back to the browser language',
        locale => {
            vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
            window.history.replaceState({}, '', '/login');

            expect(new URL(getSocialAuthUrl('google', { locale })).searchParams.get('locale')).toBe(
                'en',
            );
        },
    );
});

test('Google OAuth uses a prefixed URL before conflicting browser language', () => {
    window.history.replaceState({}, '', '/ru/privacy');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    expect(new URL(getSocialAuthUrl('google')).searchParams.get('locale')).toBe('ru');
});

test('English SSG homepage uses supported browser language for signup', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ja-JP', 'ru-RU']);
    expect(new URL(getSocialAuthUrl('google')).searchParams.get('locale')).toBe('ru');
});

test('unsupported browser language defaults new signup to English', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    expect(new URL(getSocialAuthUrl('google')).searchParams.get('locale')).toBe('en');
});
