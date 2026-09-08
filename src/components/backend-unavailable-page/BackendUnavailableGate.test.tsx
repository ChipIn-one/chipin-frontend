import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { BackendUnavailableGate } from './index';

const CONFIRMED_CLIENT_STATE = 'Confirmed client state';
const PRESERVED_ACTION_LABEL = 'Preserved action';

beforeEach(() => {
    useBackendAvailabilityStore.setState({ isUnavailable: false });
    useAuthStore.setState({
        status: 'authenticated',
        unauthReason: undefined,
        isNewUser: false,
    });
});

test('keeps existing app content and session state mounted while showing the fallback', () => {
    useBackendAvailabilityStore.setState({ isUnavailable: true });

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <BackendUnavailableGate>
                <div>{CONFIRMED_CLIENT_STATE}</div>
            </BackendUnavailableGate>
        </ThemeProvider>,
    );

    expect(screen.getByText(CONFIRMED_CLIENT_STATE)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(useAuthStore.getState().status).toBe('authenticated');
});

test('makes the preserved app subtree inert while unavailable and interactive after recovery', () => {
    useBackendAvailabilityStore.setState({ isUnavailable: true });

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <BackendUnavailableGate>
                <button type="button">{PRESERVED_ACTION_LABEL}</button>
            </BackendUnavailableGate>
        </ThemeProvider>,
    );

    const appContent = screen.getByText(PRESERVED_ACTION_LABEL).parentElement;

    expect(appContent?.hasAttribute('inert')).toBe(true);

    act(() => {
        useBackendAvailabilityStore.getState().clearUnavailable();
    });

    expect(appContent?.hasAttribute('inert')).toBe(false);
});
