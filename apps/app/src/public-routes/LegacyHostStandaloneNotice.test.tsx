import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

import { LegacyHostStandaloneNotice } from './LegacyHostStandaloneNotice';

const pwa = vi.hoisted(() => ({ isInstalled: false }));

vi.mock('helpers/pwa', () => ({ checkIsPwaInstalled: () => pwa.isInstalled }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { appHost?: string }) =>
            options?.appHost ? `${key}:${options.appHost}` : key,
    }),
}));

const renderOn = (hostname: string, isInstalled: boolean) => {
    pwa.isInstalled = isInstalled;
    vi.stubGlobal('location', { ...window.location, hostname });
    return render(<LegacyHostStandaloneNotice />);
};

afterEach(() => {
    vi.unstubAllGlobals();
    pwa.isInstalled = false;
});

// #758: an icon installed from a legacy host tells the user to install the app host instead.
test.each([
    ['chipin.one', 'app.chipin.one'],
    ['dev.chipin.one', 'app-dev.chipin.one'],
])('on the legacy host %s in standalone mode names %s, with no link', (hostname, appHost) => {
    renderOn(hostname, true);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('legacyHostStandaloneNotice.title');
    expect(notice.textContent).toContain(`legacyHostStandaloneNotice.description:${appHost}`);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
});

test.each(['chipin.one', 'dev.chipin.one'])(
    'on the legacy host %s in a browser is hidden',
    host => {
        renderOn(host, false);

        expect(screen.queryByRole('status')).toBeNull();
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'on %s is hidden in standalone mode and in a browser',
    hostname => {
        renderOn(hostname, true).unmount();
        expect(screen.queryByRole('status')).toBeNull();

        renderOn(hostname, false);
        expect(screen.queryByRole('status')).toBeNull();
    },
);

test('is not prerendered (server snapshot: not standalone)', () => {
    pwa.isInstalled = true;
    vi.stubGlobal('location', { ...window.location, hostname: 'chipin.one' });

    expect(renderToString(<LegacyHostStandaloneNotice />)).toBe('');
});
