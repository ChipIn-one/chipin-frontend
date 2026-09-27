import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

const healthMocks = vi.hoisted(() => ({
    checkBackendHealth: vi.fn<() => Promise<void>>(),
}));

vi.mock('api/healthApi', () => ({
    checkBackendHealth: healthMocks.checkBackendHealth,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

import { BackendUnavailablePage } from './index';

const renderPage = () => {
    return render(
        <ThemeProvider theme={lightThemeStyled}>
            <BackendUnavailablePage />
        </ThemeProvider>,
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    healthMocks.checkBackendHealth.mockResolvedValue(undefined);
    useBackendAvailabilityStore.setState({ isUnavailable: true });
});

test('renders a blocking localized dialog with an accessible retry action', () => {
    renderPage();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'backendUnavailable.title' })).toBeTruthy();
    expect(screen.getByText('backendUnavailable.description')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'backendUnavailable.tryAgain' })).toBeTruthy();
    expect(screen.queryByText(/status|http|api|stack/i)).toBeNull();
});

test('reserves retry feedback space before the first failed retry', () => {
    renderPage();

    expect(
        screen.getByText('backendUnavailable.retryFailed').getAttribute('aria-hidden'),
    ).toBe('true');
});

test('shows a stable loading state and prevents duplicate retries', async () => {
    let resolveHealth: (() => void) | undefined;
    healthMocks.checkBackendHealth.mockImplementationOnce(
        () =>
            new Promise<void>(resolve => {
                resolveHealth = resolve;
            }),
    );
    const user = userEvent.setup();

    renderPage();

    const retryButton = screen.getByRole('button', { name: 'backendUnavailable.tryAgain' });
    await user.click(retryButton);

    expect(retryButton.hasAttribute('disabled')).toBe(true);
    expect(retryButton.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'backendUnavailable.tryAgain' })).toBe(retryButton);

    await user.click(retryButton);
    expect(healthMocks.checkBackendHealth).toHaveBeenCalledOnce();

    resolveHealth?.();

    await waitFor(() => {
        expect(retryButton.hasAttribute('disabled')).toBe(false);
        expect(retryButton.getAttribute('aria-busy')).toBe('false');
    });
});

test('keeps the page visible when a retry remains unhealthy', () => {
    healthMocks.checkBackendHealth.mockRejectedValueOnce(new Error('still offline'));
    const user = userEvent.setup();

    renderPage();

    return user
        .click(screen.getByRole('button', { name: 'backendUnavailable.tryAgain' }))
        .then(() => {
            expect(healthMocks.checkBackendHealth).toHaveBeenCalledOnce();
            expect(screen.getByRole('dialog')).toBeTruthy();
            expect(screen.getByText('backendUnavailable.retryFailed')).toBeTruthy();
            expect(
                screen.getByText('backendUnavailable.retryFailed').getAttribute('aria-hidden'),
            ).toBe('false');
            expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(true);
        });
});

test('clears unavailable state and restores normal rendering after a healthy retry', () => {
    const user = userEvent.setup();

    renderPage();

    return user
        .click(screen.getByRole('button', { name: 'backendUnavailable.tryAgain' }))
        .then(() => {
            expect(healthMocks.checkBackendHealth).toHaveBeenCalledOnce();
            expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(false);
        });
});
