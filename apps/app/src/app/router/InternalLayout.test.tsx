import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { useConnectivityStore } from 'store/connectivityStore';

import { BareLayout } from './InternalLayout';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const PAGE_CONTENT = 'Join page content';

const renderBareLayout = () =>
    render(
        <MemoryRouter initialEntries={['/group/join/token']}>
            <Routes>
                <Route element={<BareLayout />}>
                    <Route path="/group/join/:token" element={<p>{PAGE_CONTENT}</p>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

const { retryBackendHealth: originalRetry } = useConnectivityStore.getState();

afterEach(() => {
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online', retryBackendHealth: originalRetry });
});

it('NET-001: BareLayout shows the offline banner with Retry while offline', async () => {
    const retryBackendHealth = vi.fn(() => Promise.reject(new Error('unreachable')));
    useConnectivityStore.setState({ mode: 'offline', retryBackendHealth });
    const user = userEvent.setup();
    renderBareLayout();

    const banner = screen.getByRole('status');
    const content = screen.getByText(PAGE_CONTENT);
    expect(banner.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'network.retry' }));
    expect(retryBackendHealth).toHaveBeenCalledTimes(1);
});

it('NET-001: BareLayout shows no offline banner while online', () => {
    renderBareLayout();

    expect(screen.getByText(PAGE_CONTENT)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
});

it('NET-001: BareLayout hides the offline banner when the network comes back', () => {
    act(() => {
        onlineManager.setOnline(false);
    });
    renderBareLayout();
    expect(screen.getByRole('status')).toBeTruthy();

    act(() => {
        onlineManager.setOnline(true);
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(PAGE_CONTENT)).toBeTruthy();
});
