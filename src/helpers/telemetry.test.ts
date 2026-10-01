import { expect, test } from 'vitest';

import {
    resolveTelemetryEnvironment,
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
])('redacts invite tokens from telemetry URLs', (url, expected) => {
    expect(sanitizeTelemetryUrl(url)).toBe(expected);
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
