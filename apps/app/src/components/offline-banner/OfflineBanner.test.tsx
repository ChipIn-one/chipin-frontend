import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

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

beforeEach(() => {
    healthMocks.probeBackendHealth.mockResolvedValue('unreachable');
    onlineManager.setOnline(false);
});

afterEach(() => {
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
});

test('a failed retry shows the failure text; a new offline episode starts with the normal text', async () => {
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
