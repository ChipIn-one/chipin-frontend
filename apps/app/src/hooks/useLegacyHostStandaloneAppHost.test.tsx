import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

import { useLegacyHostStandaloneAppHost } from './useLegacyHostStandaloneAppHost';

const pwa = vi.hoisted(() => ({ isInstalled: false }));

vi.mock('helpers/pwa', () => ({ checkIsPwaInstalled: () => pwa.isInstalled }));

const stubHost = (hostname: string, isInstalled: boolean) => {
    pwa.isInstalled = isInstalled;
    vi.stubGlobal('location', { ...window.location, hostname });
};

afterEach(() => {
    vi.unstubAllGlobals();
    pwa.isInstalled = false;
});

// #758: only an icon installed from a legacy host gets the notice.
test.each([
    ['chipin.one', 'app.chipin.one'],
    ['dev.chipin.one', 'app-dev.chipin.one'],
])('on the legacy host %s in standalone mode names %s', (hostname, appHost) => {
    stubHost(hostname, true);

    expect(renderHook(() => useLegacyHostStandaloneAppHost()).result.current).toBe(appHost);
});

test.each(['chipin.one', 'dev.chipin.one'])('on the legacy host %s in a browser is null', host => {
    stubHost(host, false);

    expect(renderHook(() => useLegacyHostStandaloneAppHost()).result.current).toBeNull();
});

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'on %s is null in standalone mode and in a browser',
    hostname => {
        stubHost(hostname, true);
        expect(renderHook(() => useLegacyHostStandaloneAppHost()).result.current).toBeNull();

        stubHost(hostname, false);
        expect(renderHook(() => useLegacyHostStandaloneAppHost()).result.current).toBeNull();
    },
);

test('prerenders null whatever the host and display mode (server snapshot)', () => {
    stubHost('chipin.one', true);
    const Probe = () => <output>{useLegacyHostStandaloneAppHost() ?? 'none'}</output>;

    expect(renderToString(<Probe />)).toContain('none');
});
