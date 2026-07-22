import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group, User } from 'api/chipin.types';
import { useUsersStore } from 'store/usersStore';

import GroupBalancesTab from './GroupBalancesTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

const groupUser = {
    id: currentUser.id,
    email: currentUser.email,
    displayName: currentUser.displayName,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    picture: currentUser.picture,
    createdAt: currentUser.createdAt,
    updatedAt: currentUser.updatedAt,
};

const group: Group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: null,
    creator: groupUser,
    members: [
        { user: groupUser, balancesByCurrency: {} },
        {
            user: {
                ...groupUser,
                id: 'user-2',
                displayName: 'Alex',
                firstName: 'Alex',
            },
            balancesByCurrency: {
                USD: { currency: 'USD', netBalance: -20 },
                EUR: { currency: 'EUR', netBalance: 15 },
                BZD: { currency: 'BZD', netBalance: 0 },
            },
        },
        {
            user: {
                ...groupUser,
                id: 'user-3',
                displayName: 'Bob',
                firstName: 'Bob',
            },
            balancesByCurrency: {},
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    emoji: null,
    coverUrl: null,
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: [],
};

beforeEach(() => {
    useUsersStore.setState({ user: currentUser });
});

test('shows member debts by direction and disables settlement when there are none', () => {
    render(<GroupBalancesTab group={group} />);

    expect(screen.getByText('balances.youOwe')).toBeTruthy();
    expect(screen.getByText('balances.youOwed')).toBeTruthy();
    expect(screen.getByText('balances.settledUp')).toBeTruthy();
    expect(
        screen.getAllByText((_, element) => element?.textContent === '20 USD').length,
    ).toBeGreaterThan(0);
    expect(
        screen.getAllByText((_, element) => element?.textContent === '15 EUR').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('BZD')).toBeNull();
    expect(screen.getByRole('button', { name: 'common:buttons.settleUp' })).toHaveProperty(
        'disabled',
        false,
    );
    expect(screen.getByRole('button', { name: 'group:page.balances.settled' })).toHaveProperty(
        'disabled',
        true,
    );
});
