import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import MobileNavBar from './MobileNavBar';

import 'i18n/index';

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

beforeEach(() => {
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        friends: [],
    });
});

test.each([
    { appMode: APP_MODES.SOLO, expectedRoute: '/dashboard' },
    { appMode: APP_MODES.GROUP, expectedRoute: '/dashboard' },
])('opens $expectedRoute from the home link in $appMode mode', ({ appMode, expectedRoute }) => {
    const interaction = userEvent.setup();
    useDashboardStore.setState({ appMode });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <MobileNavBar />
                <LocationPath />
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: 'Dashboard' })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe(expectedRoute);
    });
});

test('lifts the mobile add-expense action without changing the nav item layout', () => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <MobileNavBar />
            </ThemeProvider>
        </MemoryRouter>,
    );

    const addExpenseButton = screen.getByRole('button', { name: 'Add expense' });
    const centerAction = addExpenseButton.parentElement as HTMLElement;
    const navContent = centerAction.parentElement as HTMLElement;
    const navWrapper = navContent.parentElement as HTMLElement;
    const navSurface = navContent.previousElementSibling as HTMLElement;

    expect(getComputedStyle(navWrapper).getPropertyValue('--mobile-nav-action-lift').trim()).toBe(
        'var(--space-3)',
    );
    expect(getComputedStyle(navWrapper).getPropertyValue('--mobile-nav-cutout-center-y').trim()).toBe(
        'calc(0px - var(--mobile-nav-action-lift))',
    );
    expect(getComputedStyle(centerAction).transform).toBe(
        'translate(-50%, calc(-50% - var(--mobile-nav-action-lift)))',
    );
    expect(getComputedStyle(navSurface).getPropertyValue('--mobile-nav-cutout-radius').trim()).toBe(
        'calc(var(--space-7) - var(--space-1))',
    );
});
