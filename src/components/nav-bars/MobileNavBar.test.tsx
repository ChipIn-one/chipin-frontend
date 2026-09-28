import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
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

test('reserves a center gap around the mobile add-expense action', () => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <MobileNavBar />
            </ThemeProvider>
        </MemoryRouter>,
    );

    const dashboardItem = screen.getByRole('link', { name: 'Dashboard' }).parentElement as HTMLElement;
    const friendsItem = screen.getByRole('link', { name: 'Friends' }).parentElement as HTMLElement;
    const settingsItem = screen.getByRole('link', { name: 'Settings' }).parentElement as HTMLElement;
    const navItems = dashboardItem.parentElement as HTMLElement;
    const navStyle = getComputedStyle(navItems);

    expect(navStyle.display).toBe('grid');
    expect(navStyle.getPropertyValue('--mobile-nav-center-gap').trim()).toBe(
        'calc(var(--space-7) + var(--space-7))',
    );
    expect(getComputedStyle(friendsItem).gridColumnStart).toBe('4');
    expect(getComputedStyle(settingsItem).gridColumnStart).toBe('5');
});
