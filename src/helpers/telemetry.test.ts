import { expect, test } from 'vitest';

import { sanitizeTelemetryUrl } from './telemetry';

test('removes query parameters and fragments from telemetry URLs', () => {
    expect(
        sanitizeTelemetryUrl(
            'https://chipin.one/oauth/callback?code=secret-code&returnTo=%2Fdashboard#callback',
        ),
    ).toBe('https://chipin.one/oauth/callback');
});

test('redacts invite tokens from telemetry URLs', () => {
    expect(
        sanitizeTelemetryUrl(
            'https://chipin.one/group/join/private-invite-token?source=share',
        ),
    ).toBe('https://chipin.one/group/join/:inviteToken');
});
