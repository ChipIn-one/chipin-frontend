import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group } from 'api/chipin.types';

import GroupTabsContent from './GroupTabsContent';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('store/loadingStore', () => ({
    useLoadingStore: () => false,
}));

vi.mock('components/modals', () => ({
    SettleUpModal: ({ group }: { group: Group }) => (
        <button type="button">{group.id}</button>
    ),
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => null,
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: () => null,
}));

vi.mock('./GroupBalancesTab', () => ({ default: () => null }));
vi.mock('./GroupSettingsTab', () => ({ default: () => null }));

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
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

test('renders member actions on the left and settle up on the right before tabs', () => {
    render(<GroupTabsContent group={group} />);

    const settleUp = screen.getByRole('button', {
        name: group.id,
    });
    const invitePeople = screen.getByRole('button', {
        name: 'common:buttons.invitePeople',
    });
    const tabsNav = screen.getByRole('tablist');
    const actions = tabsNav.previousElementSibling;
    const memberActions = actions?.firstElementChild;

    expect(actions?.lastElementChild).toBe(settleUp.parentElement);
    expect(memberActions).not.toBeNull();
    expect(memberActions?.firstElementChild?.children).toHaveLength(
        group.members.length,
    );
    expect(memberActions?.contains(invitePeople)).toBe(true);
});
