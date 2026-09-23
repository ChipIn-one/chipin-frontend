import { expect, test } from 'vitest';

import * as telemetry from './telemetry';

test('removes query parameters and fragments from telemetry URLs', () => {
    expect(
        telemetry.sanitizeTelemetryUrl(
            'https://chipin.one/oauth/callback?code=secret-code&returnTo=%2Fdashboard#callback',
        ),
    ).toBe('https://chipin.one/oauth/callback');
});

test('redacts invite tokens from telemetry URLs', () => {
    expect(
        telemetry.sanitizeTelemetryUrl(
            'https://chipin.one/group/join/private-invite-token?source=share',
        ),
    ).toBe('https://chipin.one/group/join/:inviteToken');
});

test('uses development telemetry on Vercel-generated domains', () => {
    expect(telemetry).toHaveProperty('resolveTelemetryEnvironment');

    const resolveTelemetryEnvironment = Reflect.get(
        telemetry,
        'resolveTelemetryEnvironment',
    ) as (buildEnvironment: string, hostname: string) => string;

    expect(
        resolveTelemetryEnvironment('production', 'chipin-frontend.vercel.app'),
    ).toBe('development');
    expect(resolveTelemetryEnvironment('production', 'chipin.one')).toBe(
        'production',
    );
});
