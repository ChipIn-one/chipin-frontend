import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group, SelfUser } from 'api/chipin.types';
import { useUsersStore } from 'store/users-store';

import GroupBalancesTab from './GroupBalancesTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./GroupInviteEmptyState', () => ({
    default: ({ group: inviteGroup }: { group: Group }) => (
        <div data-testid="group-invite-empty-state">{inviteGroup.id}</div>
    ),
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    picture: null,
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
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const groupUser = {
    id: currentUser.id,
    email: currentUser.email,
    displayName: currentUser.displayName,
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
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
};

beforeEach(() => {
    useUsersStore.setState({ user: currentUser });
});

test('shows invite onboarding for an empty single-member group', () => {
    render(
        <GroupBalancesTab
            group={{
                ...group,
                members: [group.members[0]],
                lastUsedCurrency: null,
            }}
        />,
    );

    expect(screen.getByTestId('group-invite-empty-state').textContent).toBe(group.id);
});

test('keeps the existing no-members state after the group has expense history', () => {
    render(
        <GroupBalancesTab
            group={{
                ...group,
                members: [group.members[0]],
                lastUsedCurrency: 'USD',
            }}
        />,
    );

    expect(screen.queryByTestId('group-invite-empty-state')).toBeNull();
    expect(screen.getByText('page.balances.empty')).toBeTruthy();
});

test('shows member debts by direction and disables settlement when there are none', () => {
    render(<GroupBalancesTab group={group} />);

    expect(screen.getByText('balances.youOwe')).toBeTruthy();
    expect(screen.getByText('balances.youAreOwed')).toBeTruthy();
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
