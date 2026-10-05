import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { KnownUser, UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import MobileNavBar from './MobileNavBar';

import 'i18n/index';

const LocationPath = () => {
    const location = useLocation();

    return (
        <output aria-label="Current route">
            {location.pathname}
        </output>
    );
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

const friend = {
    user: {
        id: 'friend-1',
        email: 'friend@example.com',
        displayName: 'Friend',
        firstName: 'Friend',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    },
    balances: [],
    lastUsedCurrency: null,
} satisfies KnownUser;

const resolveGlobalTargets = () => {
    useLoadingStore
        .getState()
        .setLoading('group', 'list', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('users', 'friends', 'fetched');
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useGroupsStore.getState().setInitialGroupsStore();
    useLoadingStore.getState().setInitialLoadingStore();
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        friends: [],
    });
});

test.each([
    {
        appMode: APP_MODES.SOLO,
        expectedRoute: '/dashboard',
    },
    {
        appMode: APP_MODES.GROUP,
        expectedRoute: '/dashboard',
    },
])(
    'opens $expectedRoute from the home link in $appMode mode',
    ({ appMode, expectedRoute }) => {
        const interaction = userEvent.setup();
        useDashboardStore.setState({ appMode });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <ThemeProvider theme={lightThemeStyled}>
                    <Theme>
                        <MobileNavBar />
                        <LocationPath />
                    </Theme>
                </ThemeProvider>
            </MemoryRouter>,
        );

        return interaction
            .click(
                screen.getByRole('link', {
                    name: 'Dashboard',
                }),
            )
            .then(() => {
                expect(
                    screen.getByLabelText('Current route')
                        .textContent,
                ).toBe(expectedRoute);
            });
    },
);

test('EXP-062 removes the center slot and leaves four navigation items', () => {
    resolveGlobalTargets();

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <MobileNavBar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(4);
});

test('EXP-062 restores the lifted Add Expense slot for a valid target', () => {
    resolveGlobalTargets();
    useUsersStore.setState({ friends: [friend] });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <MobileNavBar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    const addExpenseButton = screen.getByRole('button', {
        name: 'Add expense',
    });
    const centerAction =
        addExpenseButton.parentElement as HTMLElement;
    const navContent =
        centerAction.parentElement as HTMLElement;
    const navWrapper =
        navContent.parentElement as HTMLElement;
    const navSurface =
        navContent.previousElementSibling as HTMLElement;

    expect(
        getComputedStyle(navWrapper)
            .getPropertyValue('--mobile-nav-action-lift')
            .trim(),
    ).toBe('var(--space-3)');
    expect(
        getComputedStyle(navWrapper)
            .getPropertyValue('--mobile-nav-cutout-center-y')
            .trim(),
    ).toBe(
        'calc(0px - var(--mobile-nav-action-lift))',
    );
    expect(getComputedStyle(centerAction).transform).toBe(
        'translate(-50%, calc(-50% - var(--mobile-nav-action-lift)))',
    );
    expect(
        getComputedStyle(navSurface)
            .getPropertyValue('--mobile-nav-cutout-radius')
            .trim(),
    ).toBe(
        'calc(var(--space-7) - var(--space-1))',
    );
});
