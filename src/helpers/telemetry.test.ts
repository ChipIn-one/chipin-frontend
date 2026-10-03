import { expect, test } from 'vitest';

import {
    resolveTelemetryEnvironment,
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
    [
        '/users/invite/private-friend-token?source=xhr',
        '/users/invite/:inviteToken',
    ],
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
    expect(
        resolveTelemetryEnvironment('production', 'chipin-frontend.vercel.app'),
    ).toBe('development');
    expect(
        resolveTelemetryEnvironment(
            'preview',
            'chipin-frontend-git-feature-123.vercel.app',
        ),
    ).toBe('development');
    expect(resolveTelemetryEnvironment('production', 'chipin.one')).toBe(
        'production',
    );
});
