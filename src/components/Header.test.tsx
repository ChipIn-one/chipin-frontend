import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserSettings } from 'api/chipin.types';
import { PROJECT_NAME } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import Header from './Header';

import 'i18n/index';

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: true,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        friends: [],
    });
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
});

test('opens the preferred Solo route when an authenticated user clicks the logo', () => {
    const interaction = userEvent.setup();

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('link', { name: PROJECT_NAME }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/solo');
        });
});

test('falls back to the Group route for a non-admin with stale Solo state', () => {
    const interaction = userEvent.setup();

    useUsersStore.setState({
        user: null,
        localUser: { role: 'USER', settings },
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('link', { name: PROJECT_NAME }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
            expect(screen.getByText('Group')).toBeTruthy();
            expect(screen.queryByText('Solo')).toBeNull();
        });
});

test('opens the active Solo mode when the logo is clicked from another page', () => {
    const interaction = userEvent.setup();

    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    useUsersStore.setState({
        localUser: {
            role: 'ADMIN',
            settings: { ...settings, soloModeByDefault: false },
        },
    });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('link', { name: PROJECT_NAME }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/solo');
        });
});

test('hides the mode badge on the landing page', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByText(PROJECT_NAME)).toBeTruthy();
    expect(screen.queryByText('Group')).toBeNull();
    expect(screen.queryByText('Solo')).toBeNull();
});
