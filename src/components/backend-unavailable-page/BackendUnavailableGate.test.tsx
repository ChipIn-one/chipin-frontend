import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { BackendUnavailableGate } from './index';

const CONFIRMED_CLIENT_STATE = 'Confirmed client state';

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
