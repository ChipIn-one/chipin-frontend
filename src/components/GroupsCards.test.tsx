import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group } from 'api/chipin.types';
import { useLoadingStore } from 'store/loadingStore';

import GroupsCards from './GroupsCards';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./group-card', () => ({
    GroupCard: ({ group }: { group: Group }) => <div>{group.name}</div>,
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
    coverUrl: 'https://cdn.example.com/group.webp',
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: {
        items: [],
        nextCursor: null,
    },
};

const settledGroup: Group = {
    ...group,
    id: 'group-2',
    name: 'Settled group',
    members: group.members.map(member => ({ ...member, balancesByCurrency: {} })),
};

const secondActiveGroup: Group = {
    ...group,
    id: 'group-3',
    name: 'Bali',
};

beforeEach(() => {
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('group', 'list', 'fetched');
    useLoadingStore.getState().setLoading('dashboard', 'data', 'fetched');
});

test('keeps a mixed-direction group in both debt filters', () => {
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
        });
});

test('shows a selected settled group before the active groups that remain visible', () => {
    render(
        <GroupsCards
            groups={[group, settledGroup]}
            selectedGroupId={settledGroup.id}
        />,
    );

    expect(screen.getAllByText(/Vietnam|Settled group/).map(element => element.textContent)).toEqual([
        settledGroup.name,
        group.name,
    ]);
    expect(screen.queryByRole('button', { name: 'groups.showSettled' })).toBeNull();
});

test('keeps the source order when the selected group is already visible', () => {
    render(
        <GroupsCards
            groups={[group, secondActiveGroup]}
            selectedGroupId={secondActiveGroup.id}
        />,
    );

    expect(screen.getAllByText(/Vietnam|Bali/).map(element => element.textContent)).toEqual([
        group.name,
        secondActiveGroup.name,
    ]);
});

test('shows and hides settled groups below the active debt filter results', () => {
    const user = userEvent.setup();

    render(<GroupsCards groups={[group, settledGroup]} />);

    return user
        .click(screen.getByRole('button', { name: 'summary.owedToYou' }))
        .then(() => {
            expect(screen.getByText(group.name)).toBeTruthy();
            expect(screen.queryByText(settledGroup.name)).toBeNull();
            return user.click(screen.getByRole('button', { name: 'groups.showSettled' }));
        })
        .then(() => {
            expect(
                screen
                    .getAllByText(/Vietnam|Settled group/)
                    .map(element => element.textContent),
            ).toEqual([group.name, settledGroup.name]);
            return user.click(screen.getByRole('button', { name: 'groups.hideSettled' }));
        })
        .then(() => {
            expect(screen.getByText(group.name)).toBeTruthy();
            expect(screen.queryByText(settledGroup.name)).toBeNull();
        });
});
