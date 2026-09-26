import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
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

test('renders localized non-technical outage content and an accessible retry action', () => {
    renderPage();

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'backendUnavailable.title' })).toBeTruthy();
    expect(screen.getByText('backendUnavailable.description')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'backendUnavailable.tryAgain' })).toBeTruthy();
    expect(screen.queryByText(/status|http|api|stack/i)).toBeNull();
});

test('keeps the page visible when a retry remains unhealthy', () => {
    healthMocks.checkBackendHealth.mockRejectedValueOnce(new Error('still offline'));
    const user = userEvent.setup();

    renderPage();

    return user
        .click(screen.getByRole('button', { name: 'backendUnavailable.tryAgain' }))
        .then(() => {
            expect(healthMocks.checkBackendHealth).toHaveBeenCalledOnce();
            expect(screen.getByRole('alert')).toBeTruthy();
            expect(screen.getByText('backendUnavailable.retryFailed')).toBeTruthy();
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
