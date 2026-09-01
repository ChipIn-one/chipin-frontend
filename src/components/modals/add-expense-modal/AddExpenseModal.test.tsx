import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group, SelfUser } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

import AddExpenseModal from './AddExpenseModal';

import 'i18n/index';

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const currentUser = {
    ...creator,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
} satisfies SelfUser;

beforeEach(() => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useExpenseModalStore.getState().reset();
    useGroupsStore.getState().setInitialGroupsStore();
    useGroupsStore.setState({ groups: [group], selectedGroup: group });
    useUsersStore.setState({ user: currentUser });
    useExpenseModalStore.getState().open();
});

test('explains why adding an expense is unavailable for a single-member group', () => {
    render(
        <MemoryRouter initialEntries={['/group/group-1']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
    );

    return screen.findByRole('status').then(callout => {
        expect(callout.textContent).toContain(
            "You're the only one in this group. Add friends to track expenses.",
        );
        expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty(
            'disabled',
            true,
        );
    });
});

test.each(['USER', 'ADMIN'] as const)('does not offer the Solo entry point to a $role user', role => {
    useUsersStore.setState({ user: { ...currentUser, role }, localUser: null, friends: [] });

    render(
        <MemoryRouter initialEntries={['/group/group-1']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Solo mode' })).toBeNull();
});

test('uses the edit title and Save action in edit mode', () => {
    useExpenseModalStore.setState({ mode: 'edit', isOpened: true });

    render(
        <MemoryRouter initialEntries={['/activity']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByText('Edit expense')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty(
        'disabled',
        true,
    );
});
