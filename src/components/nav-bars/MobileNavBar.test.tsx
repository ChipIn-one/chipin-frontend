import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import type { Group, SelfUser, UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { seedGroupsList } from 'test/groupsList';
import { createKnownUser, seedKnownUsers } from 'test/knownUsers';
import { seedSelfUser } from 'test/selfUserSeed';

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

const currentUser = {
    id: 'current-user',
    email: 'current@example.com',
    displayName: 'Current user',
    picture: null,
    role: 'ADMIN',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings,
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const friend = createKnownUser('friend-1');

const soloGroup = {
    id: 'group-1',
    name: 'Solo group',
    inviteToken: 'invite-token',
    description: null,
    creator: friend.user,
    members: [{ user: friend.user, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

// The groups list has loaded without a group.
const resolveGlobalTargets = () => {
    seedGroupsList([]);
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    useLoadingStore.getState().setInitialLoadingStore();
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
])('opens $expectedRoute from the home link in $appMode mode', ({ appMode, expectedRoute }) => {
    const interaction = userEvent.setup();
    useUiPrefsStore.setState({ appMode });

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
            expect(screen.getByLabelText('Current route').textContent).toBe(expectedRoute);
        });
});

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

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(4);
});

test('EXP-062 keeps four mobile items with only a one-member group', () => {
    resolveGlobalTargets();
    seedSelfUser(currentUser);
    seedGroupsList([soloGroup]);

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <MobileNavBar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(4);
});

test('EXP-062 keeps the center action during a confirmed friend refresh', () => {
    seedSelfUser(currentUser);
    // Cached friends stay a resolved target while the query refetches.
    seedKnownUsers([friend]);

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <MobileNavBar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Add expense' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(4);
});

test('EXP-062 restores the lifted Add Expense slot for a valid target', () => {
    resolveGlobalTargets();
    seedSelfUser(currentUser);
    seedKnownUsers([friend]);

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
    const centerAction = addExpenseButton.parentElement as HTMLElement;
    const navContent = centerAction.parentElement as HTMLElement;
    const navWrapper = navContent.parentElement as HTMLElement;
    const navSurface = navContent.previousElementSibling as HTMLElement;

    expect(getComputedStyle(navWrapper).getPropertyValue('--mobile-nav-action-lift').trim()).toBe(
        'var(--space-3)',
    );
    expect(
        getComputedStyle(navWrapper).getPropertyValue('--mobile-nav-cutout-center-y').trim(),
    ).toBe('calc(0px - var(--mobile-nav-action-lift))');
    expect(getComputedStyle(centerAction).transform).toBe(
        'translate(-50%, calc(-50% - var(--mobile-nav-action-lift)))',
    );
    expect(getComputedStyle(navSurface).getPropertyValue('--mobile-nav-cutout-radius').trim()).toBe(
        'calc(var(--space-7) - var(--space-1))',
    );
});
