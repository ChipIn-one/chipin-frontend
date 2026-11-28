import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import type { Group, SelfUser, UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { seedGroupsList } from 'test/groupsList';
import { createKnownUser, seedKnownUsers } from 'test/knownUsers';
import { seedSelfUser } from 'test/selfUserSeed';

import { MobileNavBar } from './MobileNavBar';

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
            <Theme>
                <MobileNavBar />
                <LocationPath />
            </Theme>
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
            <Theme>
                <MobileNavBar />
            </Theme>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    // Without the center action the surface is solid: no cutout for it.
    expect(document.querySelector('[data-cutout]')?.getAttribute('data-cutout')).toBe('false');
});

test('EXP-062 keeps four mobile items with only a one-member group', () => {
    resolveGlobalTargets();
    seedSelfUser(currentUser);
    seedGroupsList([soloGroup]);

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Theme>
                <MobileNavBar />
            </Theme>
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
            <Theme>
                <MobileNavBar />
            </Theme>
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
            <Theme>
                <MobileNavBar />
            </Theme>
        </MemoryRouter>,
    );

    const addExpenseButton = screen.getByRole('button', {
        name: 'Add expense',
    });
    const centerAction = addExpenseButton.parentElement as HTMLElement;
    const navContent = centerAction.parentElement as HTMLElement;
    const navSurface = navContent.previousElementSibling as HTMLElement;

    // The lifted slot sits in the nav content, next to the items, over the surface cutout.
    expect(navContent.contains(screen.getByRole('link', { name: 'Dashboard' }))).toBe(true);
    expect(centerAction.contains(screen.getByRole('link', { name: 'Dashboard' }))).toBe(false);
    expect(navSurface.getAttribute('data-cutout')).toBe('true');
});

test('marks the active item with aria-current, not by color alone', () => {
    resolveGlobalTargets();

    render(
        <MemoryRouter initialEntries={['/activity']}>
            <Theme>
                <MobileNavBar />
            </Theme>
        </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Activity' }).getAttribute('aria-current')).toBe(
        'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
});
