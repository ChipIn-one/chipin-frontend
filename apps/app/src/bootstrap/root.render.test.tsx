// Spec 04 §2.11 (04-2d, R2 LOW-2): the entry renders for real here. The service worker manager sits
// outside the app's error boundary: an app that crashes on its first render still registers the
// worker once and hands its registration to the error fallback; a manager that fails renders
// nothing and leaves the app running.
import { act } from 'react';
import { screen, waitFor } from '@testing-library/react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const boot = vi.hoisted(() => ({
    register: vi.fn<(options: RegisterSWOptions) => void>(),
    options: undefined as RegisterSWOptions | undefined,
    mainMode: 'crash',
    hookMode: 'ok',
}));

vi.mock('virtual:pwa-register/react', async () => {
    const { useState } = await import('react');

    return {
        useRegisterSW: (options: RegisterSWOptions) => {
            if (boot.hookMode === 'crash') {
                throw new Error('manager failed');
            }
            boot.options = options;
            useState(() => boot.register(options));
            return {};
        },
    };
});
vi.mock('main', () => ({
    default: () => {
        if (boot.mainMode === 'crash') {
            throw new Error('first render crashed');
        }
        return <p data-testid="app" />;
    },
}));
vi.mock('shared/offline/restore', () => ({ startCacheRestore: vi.fn() }));
vi.mock('app/pwa/expenseDraftReload', () => ({ startExpenseDraftReload: vi.fn() }));
vi.mock('bootstrap/initializeApi', () => ({ initializeApi: vi.fn() }));
vi.mock('bootstrap/initializeSentry', () => ({ initializeSentry: vi.fn() }));
vi.mock('i18n', () => ({
    i18n: { t: (key: string) => key },
    i18nReady: Promise.resolve(),
}));
vi.mock('i18n/htmlLang', () => ({ syncHtmlLang: vi.fn() }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));
vi.mock('styles/index.css', () => ({}));

const bootApp = async (): Promise<void> => {
    vi.stubGlobal('location', { ...window.location, hostname: 'app.chipin.one' });
    vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
        })),
    );
    document.body.innerHTML = '<div id="root"></div>';
    await act(async () => {
        await import('../root');
    });
};

beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_CHIPIN_ENV', 'prod');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    boot.register.mockClear();
    boot.options = undefined;
    boot.mainMode = 'crash';
    boot.hookMode = 'ok';
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

test('an app that crashes on first render keeps the manager: one registration, its registration reaches the fallback', async () => {
    await bootApp();

    await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(boot.register).toHaveBeenCalledOnce();

    const registration = { waiting: null } as unknown as ServiceWorkerRegistration;
    act(() => {
        boot.options?.onRegisteredSW?.('/sw.js', registration);
    });
    // Imported after the boot: the same module instance as the one root.tsx loaded.
    const { getServiceWorkerRegistration } = await import('helpers/appUpdate');

    expect(getServiceWorkerRegistration()).toBe(registration);
    expect(boot.register).toHaveBeenCalledOnce();
});

test('a manager that fails renders nothing and the app keeps running', async () => {
    boot.mainMode = 'ok';
    boot.hookMode = 'crash';

    await bootApp();

    await waitFor(() => {
        expect(screen.getByTestId('app')).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
});
