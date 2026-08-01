import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group, User } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
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
    emoji: null,
    coverUrl: null,
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: [],
} satisfies Group;

const currentUser = {
    ...creator,
    role: 'USER',
    subscriptionUntil: null,
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
} satisfies User;

beforeEach(() => {
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
