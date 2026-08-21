import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group, SelfUser } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import GroupPage from './GroupPage';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ groupId: 'group-1' }),
}));

vi.mock('components/modals', () => ({
    AddExpenseModal: ({ children }: { children: React.ReactNode }) => children,
    SettleUpModal: () => null,
}));

vi.mock('components/GroupsCards', () => ({
    default: () => null,
}));

vi.mock('components/GroupsSectionHeader', () => ({
    default: () => null,
}));

vi.mock('components/nav-bars', () => ({
    MobileNavBar: () => null,
}));

vi.mock('components/UsersRow', () => ({
    default: () => null,
}));

vi.mock('./components', () => ({
    GroupCoverSection: () => <div data-testid="group-cover-hero" />,
    GroupSummary: (props: Record<string, unknown>) => (
        <div data-testid="group-summary" data-has-layout={String('layout' in props)} />
    ),
    GroupTabsContent: ({ group }: { group: Group }) => (
        <div data-testid="group-tabs" data-group-id={group.id} />
    ),
}));

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
    useGroupsStore.getState().setInitialGroupsStore();
    useGroupsStore.setState({ groups: [group] });
    useGroupsStore.getState().setSelectedGroup(group);
    useLoadingStore.getState().setInitialLoadingStore();
    useUsersStore.setState({ user: currentUser });
});

test('composes summaries without viewport-specific component props', () => {
    render(<GroupPage />);

    const summaries = screen.getAllByTestId('group-summary');
    const mobileSummary = summaries[1];
    const tabs = screen.getByTestId('group-tabs');

    expect(summaries).toHaveLength(2);
    summaries.forEach(summary => {
        expect(summary.dataset.hasLayout).toBe('false');
    });
    expect(
        mobileSummary.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
});

test('delegates group details and actions to the responsive cover hero', () => {
    render(<GroupPage />);

    expect(screen.getAllByTestId('group-cover-hero')).toHaveLength(1);
    expect(
        screen.queryByRole('button', { name: 'common:buttons.addExpense' }),
    ).toBeNull();
});

test('selects the route group from the loaded group list', () => {
    useGroupsStore.setState({ selectedGroup: null });
    useLoadingStore.setState(state => ({
        group: { ...state.group, list: 'fetched' },
    }));

    render(<GroupPage />);

    expect(useGroupsStore.getState().selectedGroup).toEqual(group);
});

test('does not render a previously selected group for a different route', () => {
    useGroupsStore.setState({
        groups: [],
        selectedGroup: { ...group, id: 'group-2' },
        fetchSetGroupById: vi.fn(() => Promise.resolve(null)),
    });

    render(<GroupPage />);

    expect(screen.queryByTestId('group-tabs')).toBeNull();
});
