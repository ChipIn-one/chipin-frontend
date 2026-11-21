import { describe, expect, test } from 'vitest';

import {
    resolveTelemetryEnvironment,
    sanitizeStringValues,
    sanitizeTelemetryEvent,
    sanitizeTelemetryUrl,
} from './telemetry';

test('removes query parameters and fragments from telemetry URLs', () => {
    expect(
        sanitizeTelemetryUrl(
            'https://chipin.one/oauth/callback?code=secret-code&returnTo=%2Fdashboard#callback',
        ),
    ).toBe('https://chipin.one/oauth/callback');
});

test.each([
    [
        'https://chipin.one/group/join/private-invite-token?source=share',
        'https://chipin.one/group/join/:inviteToken',
    ],
    [
        'https://chipin.one/friends/join/private-friend-token?source=share',
        'https://chipin.one/friends/join/:inviteToken',
    ],
    [
        'https://api.chipin.one/users/invite/private-friend-token',
        'https://api.chipin.one/users/invite/:inviteToken',
    ],
    ['/users/invite/private-friend-token?source=xhr', '/users/invite/:inviteToken'],
    [
        'https://chipin.one/api/groups/invite/AbCdEfGhIjKlMnOpQrStUvWxYz012345?x=1',
        'https://chipin.one/api/groups/invite/:inviteToken',
    ],
    ['/groups/invite/AbCdEfGhIjKlMnOpQrStUvWxYz012345', '/groups/invite/:inviteToken'],
])('redacts invite tokens from telemetry URLs', (url, expected) => {
    expect(sanitizeTelemetryUrl(url)).toBe(expected);
});

test('redacts invite capabilities from Vercel telemetry events', () => {
    expect(
        sanitizeTelemetryEvent({
            type: 'pageview' as const,
            url: 'https://chipin.one/friends/join/private-friend-token?source=analytics',
        }),
    ).toEqual({
        type: 'pageview',
        url: 'https://chipin.one/friends/join/:inviteToken',
    });

    expect(
        sanitizeTelemetryEvent({
            type: 'vital' as const,
            url: 'https://chipin.one/friends/join/private-friend-token',
            route: '/friends/join/private-friend-token',
        }),
    ).toEqual({
        type: 'vital',
        url: 'https://chipin.one/friends/join/:inviteToken',
        route: '/friends/join/:inviteToken',
    });
});

test('uses development telemetry on Vercel-generated domains', () => {
    expect(resolveTelemetryEnvironment('production', 'chipin-frontend.vercel.app')).toBe(
        'development',
    );
    expect(
        resolveTelemetryEnvironment('preview', 'chipin-frontend-git-feature-123.vercel.app'),
    ).toBe('development');
    expect(resolveTelemetryEnvironment('production', 'chipin.one')).toBe('production');
});

test('sanitizes every string value of a telemetry record and keeps other values', () => {
    expect(
        sanitizeStringValues({
            endpoint: '/api/groups/invite/AbCdEfGhIjKlMnOpQrStUvWxYz012345',
            route: '/group/join/private-invite-token',
            status: 500,
            ok: false,
        }),
    ).toEqual({
        endpoint: '/api/groups/invite/:inviteToken',
        route: '/group/join/:inviteToken',
        status: 500,
        ok: false,
    });
});

test.each([
    'https://app.chipin.one/login?returnTo=%2Fgroup%2Fjoin%2FAbCdEfGhIjKlMnOpQrStUvWxYz012345',
    '/login?returnTo=%2Ffriends%2Fjoin%2FAbCdEfGhIjKlMnOpQrStUvWxYz012345&locale=ru',
    'https://app.chipin.one/oauth/callback?code=c&returnTo=%2Fgroup%2Fjoin%2FAbCdEfGhIjKlMnOpQrStUvWxYz012345',
])('AUTH-075 telemetry reports the sign-in URL %s without the invite token', url => {
    const sanitized = sanitizeTelemetryUrl(url);

    expect(sanitized).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz012345');
    expect(sanitized).not.toContain('returnTo');
    expect(sanitized).toMatch(/\/(?:login|oauth\/callback)$/);
});

describe('generic token redaction (FU-1)', () => {
    test.each([
        [
            'https://api.chipin.one/oauth/exchange/q8Zr1xK_vB3nTq0Lw9Ye-2Hs5Ua7Pd4Gc6Mf',
            'https://api.chipin.one/oauth/exchange/:token',
        ],
        ['/share/AbCdEfGhIjKlMnOpQrSt12/preview', '/share/:token/preview'],
        ['/reset/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg=', '/reset/:token'],
        [
            'GET https://api.chipin.one/links/q8Zr1xK_vB3nTq0Lw9Ye-2Hs failed with 500',
            'GET https://api.chipin.one/links/:token failed with 500',
        ],
        [
            'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
            'Bearer :jwt',
        ],
        // A sentence-final period does not hide the token.
        [
            'Failed to fetch /share/q8Zr1xK_vB3nTq0Lw9Ye-2Hs5Ua7Pd4Gc6Mf.',
            'Failed to fetch /share/:token.',
        ],
        // Mixed-case token without digits, and one exactly at the 20-character limit.
        ['/share/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk_-xyz', '/share/:token'],
        ['/share/AbCdEfGhIjKlMnOpQr12', '/share/:token'],
        // Lowercase alphanumeric token without separators.
        ['/share/k3j4h5g6f7d8s9a0q1w2e3', '/share/:token'],
        // A second invite URL in one string falls through to the generic rule.
        [
            '/groups/invite/AbCdEfGhIjKlMnOpQrStUvWxYz012345/accept /groups/invite/ZyXwVuTsRqPoNmLkJiHg9876',
            '/groups/invite/:inviteToken/accept /groups/invite/:token',
        ],
    ])('redacts the opaque token in %s', (input, expected) => {
        expect(sanitizeTelemetryUrl(input)).toBe(expected);
    });

    test.each([
        // UUIDs with and without dashes stay readable for debugging.
        '/groups/3f2b8c1e-9d4a-4b7e-8c2f-1a5e6d7c8b9a/expenses',
        '/groups/3f2b8c1e9d4a4b7e8c2f1a5e6d7c8b9a/expenses',
        // Content hashes and commit SHAs are hex.
        '/releases/9fceb02d0ae598e95dc970b74767f19372d61af8',
        // Built asset names carry a short hash next to a file extension.
        'https://app.chipin.one/assets/index-BxY3a9Kd.js',
        'https://app.chipin.one/assets/GroupPage-legacy-Dq7Lm2Xp9Rt4Wv8Z.js',
        'https://app.chipin.one/assets/Inter-roman-var-AbCdEfGhIjKlMnOp1234.woff2',
        // Word slugs, plain numbers and short ids are not tokens.
        '/settings/notification-preferences',
        '/expenses/12345678901234567890123',
        '/group/abc123/expense/def456',
        '/share/AbCdEfGhIjKlMnOpQ12',
        '/feature/add-payment-method-v2-screen',
        '/api/v1/users/me/notification_settings2024',
        // Hosts are not path segments.
        'https://chipin-frontend-git-feature-1234567.vercel.app/dashboard',
    ])('keeps %s unchanged', input => {
        expect(sanitizeTelemetryUrl(input)).toBe(input);
    });

    test('keeps the named invite placeholders', () => {
        expect(sanitizeTelemetryUrl('/groups/invite/AbCdEfGhIjKlMnOpQrStUvWxYz012345/accept')).toBe(
            '/groups/invite/:inviteToken/accept',
        );
        expect(sanitizeTelemetryUrl('/group/join/AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe(
            '/group/join/:inviteToken',
        );
    });

    test('redacts generic tokens in Vercel events and telemetry records', () => {
        expect(
            sanitizeTelemetryEvent({
                type: 'pageview' as const,
                url: 'https://chipin.one/share/AbCdEfGhIjKlMnOpQrSt12',
                route: '/share/AbCdEfGhIjKlMnOpQrSt12',
            }),
        ).toEqual({
            type: 'pageview',
            url: 'https://chipin.one/share/:token',
            route: '/share/:token',
        });
        expect(sanitizeStringValues({ endpoint: '/api/share/AbCdEfGhIjKlMnOpQrSt12' })).toEqual({
            endpoint: '/api/share/:token',
        });
    });
});
