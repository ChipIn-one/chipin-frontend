import { act, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';

import { BackendUnavailableGate } from './index';

const CONFIRMED_CLIENT_STATE = 'Confirmed client state';
const PRESERVED_ACTION_LABEL = 'Preserved action';

beforeEach(() => {
    useConnectivityStore.setState({ mode: 'online' });
    useAuthStore.setState({
        status: 'authenticated',
        unauthReason: undefined,
        isNewUser: false,
    });
});

test('keeps existing app content and session state mounted while showing the fallback', () => {
    useConnectivityStore.setState({ mode: 'backend-down' });

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <BackendUnavailableGate>
                <div>{CONFIRMED_CLIENT_STATE}</div>
            </BackendUnavailableGate>
        </ThemeProvider>,
    );

    expect(screen.getByText(CONFIRMED_CLIENT_STATE)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(useAuthStore.getState().status).toBe('authenticated');
});

test('makes the preserved app subtree inert while unavailable and interactive after recovery', () => {
    useConnectivityStore.setState({ mode: 'backend-down' });

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
        useConnectivityStore.setState({ mode: 'online' });
    });

    expect(appContent?.hasAttribute('inert')).toBe(false);
});

test('does not block the app while offline', () => {
    useConnectivityStore.setState({ mode: 'offline' });

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <BackendUnavailableGate>
                <button type="button">{PRESERVED_ACTION_LABEL}</button>
            </BackendUnavailableGate>
        </ThemeProvider>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(PRESERVED_ACTION_LABEL).parentElement?.hasAttribute('inert')).toBe(
        false,
    );
});
