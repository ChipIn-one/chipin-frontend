import { afterEach, expect, test, vi } from 'vitest';

import { checkIsPwaInstalled } from './pwa';

const stubDisplayMode = (isStandalone: boolean) => {
    vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
            matches: isStandalone && query === '(display-mode: standalone)',
        })),
    );
};

afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window.navigator, 'standalone');
});

test('is installed in the standalone display mode', () => {
    stubDisplayMode(true);

    expect(checkIsPwaInstalled()).toBe(true);
});

test('is installed when iOS reports navigator.standalone', () => {
    stubDisplayMode(false);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });

    expect(checkIsPwaInstalled()).toBe(true);
});

test('is not installed in a browser tab', () => {
    stubDisplayMode(false);

    expect(checkIsPwaInstalled()).toBe(false);
});

// #758: the landing reads the display mode on any host; a browser without matchMedia is a tab.
test('is not installed when the browser has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(checkIsPwaInstalled()).toBe(false);
});
