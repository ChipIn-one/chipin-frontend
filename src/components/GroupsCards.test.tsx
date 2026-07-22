import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group } from 'api/chipin.types';
import { useLoadingStore } from 'store/loadingStore';

import GroupsCards from './GroupsCards';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./GroupCard', () => ({
    default: ({ group }: { group: Group }) => <div>{group.name}</div>,
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group: Group = {
    id: 'group-1',
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: null,
    creator: currentUser,
    members: [
        { user: currentUser, balancesByCurrency: {} },
        {
            user: { ...currentUser, id: 'user-2' },
            balancesByCurrency: {
                USD: { currency: 'USD', netBalance: 20 },
            },
        },
        {
            user: { ...currentUser, id: 'user-3' },
            balancesByCurrency: {
                USD: { currency: 'USD', netBalance: -20 },
            },
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
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('group', 'list', 'fetched');
    useLoadingStore.getState().setLoading('dashboard', 'data', 'fetched');
});

test('keeps a mixed-direction group in both debt filters and out of settled', () => {
    const user = userEvent.setup();

    render(<GroupsCards groups={[group]} />);

    expect(screen.getByText(group.name)).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: 'summary.owedToYou' }))
        .then(() => {
            expect(screen.getByText(group.name)).toBeTruthy();
            return user.click(screen.getByRole('button', { name: 'summary.youOwe' }));
        })
        .then(() => {
            expect(screen.getByText(group.name)).toBeTruthy();
            return user.click(screen.getByRole('button', { name: 'groups.filterSettled' }));
        })
        .then(() => {
            expect(screen.queryByText(group.name)).toBeNull();
        });
});
