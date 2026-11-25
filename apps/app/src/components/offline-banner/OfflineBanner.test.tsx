import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { useConnectivityStore } from 'store/connectivityStore';

import { OfflineBanner } from './index';

const healthMocks = vi.hoisted(() => ({
    probeBackendHealth: vi.fn<() => Promise<'ok' | 'error' | 'unreachable'>>(),
}));

vi.mock('api/healthApi', async importOriginal => ({
    ...(await importOriginal<typeof import('api/healthApi')>()),
    probeBackendHealth: healthMocks.probeBackendHealth,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const saveUser = (): void => {
    LocalStorage.set(LS_KEY_USER, {
        id: 'user-1',
        role: 'USER',
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
            theme: 'light',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        },
    });
};

beforeEach(() => {
    healthMocks.probeBackendHealth.mockResolvedValue('unreachable');
    onlineManager.setOnline(false);
});

afterEach(() => {
    LocalStorage.remove(LS_KEY_USER);
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
});

test('NET-001 a failed retry shows the failure text; a new offline episode starts with the normal text', async () => {
    saveUser();
    const user = userEvent.setup();
    render(<OfflineBanner />);

    await user.click(screen.getByRole('button', { name: 'network.retry' }));
    expect(await screen.findByText('network.retryFailed')).toBeTruthy();

    act(() => {
        onlineManager.setOnline(true);
    });
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
        onlineManager.setOnline(false);
    });
    expect(screen.getByText('network.offlineBanner')).toBeTruthy();
    expect(screen.queryByText('network.retryFailed')).toBeNull();
});

test('a retry with a 2xx /health hides the banner', async () => {
    healthMocks.probeBackendHealth.mockResolvedValueOnce('ok');
    const user = userEvent.setup();
    render(<OfflineBanner />);

    await user.click(screen.getByRole('button', { name: 'network.retry' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('NET-001 with no user saved on the device the texts say only that there is no network', async () => {
    const user = userEvent.setup();
    render(<OfflineBanner />);

    expect(screen.getByText('network.offlineBannerNoData')).toBeTruthy();
    expect(screen.queryByText('network.offlineBanner')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'network.retry' }));

    expect(await screen.findByText('network.retryFailedNoData')).toBeTruthy();
    expect(screen.queryByText('network.retryFailed')).toBeNull();
});

test('NET-001 with a saved user the texts say that saved data is shown', () => {
    saveUser();
    render(<OfflineBanner />);

    expect(screen.getByText('network.offlineBanner')).toBeTruthy();
});
