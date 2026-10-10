import { beforeEach, expect, test, vi } from 'vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';

import type { ActivityFeedItem, Group, SelfUser } from 'api/chipin.types';
import { useDashboardStore } from 'store/dashboardStore';
import { useErrorsStore } from 'store/errorsStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import DashboardPage from './DashboardPage';

const useInfiniteScrollMock = vi.hoisted(() =>
    vi.fn<
        (params: {
            hasMore: boolean;
            isLoading: boolean;
            onLoadMore: () => Promise<void>;
        }) => () => void
    >(() => vi.fn()),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: useInfiniteScrollMock,
}));

vi.mock('components/dashboard-onboarding', () => ({
    DashboardOnboarding: () => <div data-testid="dashboard-onboarding" />,
}));

vi.mock('components/dashboard-summary', () => ({
    DashboardHeader: () => null,
    DashboardSummary: ({ hasExpenseHistory }: { hasExpenseHistory: boolean }) => (
        hasExpenseHistory ? <div data-testid="dashboard-summary" /> : null
    ),
}));

vi.mock('components/GroupsCards', () => ({
    default: ({
        groups,
    }: {
        groups: Group[];
    }) => (
        <div
            data-testid="groups-cards"
            data-count={groups.length}
        />
    ),
}));

vi.mock('components/internal-page-layout', () => ({
    InternalPageColumnsFromSm: ({
        children,
        sidePanel,
    }: {
        children: React.ReactNode;
        sidePanel: React.ReactNode;
    }) => (
        <div data-testid="dashboard-columns">
            <main data-testid="dashboard-main">
                {children}
            </main>
            <aside data-testid="dashboard-side-panel">
                {sidePanel}
            </aside>
        </div>
    ),
}));

vi.mock('components/modals/create-update-group-modal', () => ({
    CreateUpdateGroupModal: ({
        children,
    }: {
        children: React.ReactNode;
    }) => children,
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => (
        <div data-testid="activity-skeleton" />
    ),
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: ({
        children,
    }: {
        children?: React.ReactNode;
    }) => (
        <div data-testid="activity-list">
            {children}
        </div>
    ),
}));

const creator = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    firstName: 'Owner',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const currentUser = {
    id: creator.id,
    email: creator.email,
    displayName: creator.displayName,
    picture: creator.picture,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'self-invite',
    settings: {
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
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const singleMemberGroup = {
    id: 'group-1',
    name: 'Group',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [
        {
            user: creator,
            balancesByCurrency: {},
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const activityItem = {
    parent: {
        id: 'activity-1',
    },
    lastEvent: {
        id: 'activity-1',
    },
} as ActivityFeedItem;

const resolveDashboardOnboardingData = () => {
    useLoadingStore
        .getState()
        .setLoading('dashboard', 'data', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('group', 'list', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('users', 'friends', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('users', 'self', 'fetched');
};

const originalFetchSetDashboard = useDashboardStore.getState().fetchSetDashboard;
const originalFetchSetDashboardData = useDashboardStore.getState().fetchSetDashboardData;

beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.setState({
        fetchSetDashboard: originalFetchSetDashboard,
        fetchSetDashboardData: originalFetchSetDashboardData,
    });
    useDashboardStore.getState().setInitialDashboardStore();
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.setState({ user: currentUser, friends: [] });
    useLoadingStore.getState().setInitialLoadingStore();
    useErrorsStore.getState().resetErrors();
});

test('DSH-007 renders welcome only for no friends and no groups', () => {
    resolveDashboardOnboardingData();
    render(<DashboardPage />);

    const main = screen.getByTestId('dashboard-main');
    expect(within(main).getByTestId('dashboard-onboarding')).toBeTruthy();
    expect(within(main).queryByTestId('activity-list')).toBeNull();
});

test('DSH-013 puts the Create group action below No groups yet at full width', () => {
    resolveDashboardOnboardingData();
    useUsersStore.setState({ friends: [{ user: creator, balances: [], lastUsedCurrency: null }] });

    render(<DashboardPage />);

    const side = screen.getByTestId('dashboard-side-panel');
    const label = within(side).getByText('groups.emptyTitle');
    const card = label.closest('[data-empty-state]');
    const action = within(side).getByRole('button', { name: 'common:buttons.createGroup' });

    expect(card?.querySelector('[data-empty-state-action]')?.contains(action)).toBe(true);
    expect(card?.firstElementChild?.className).toContain('rt-r-fd-column');
    expect(window.getComputedStyle(action).width).toBe('100%');
});

test('DSH-012 does not reserve vertical space when the Dashboard summary is empty', () => {
    resolveDashboardOnboardingData();
    useGroupsStore.setState({ groups: [singleMemberGroup] });

    render(<DashboardPage />);

    const side = screen.getByTestId('dashboard-side-panel');
    const groups = within(side).getByTestId('groups-cards');
    const panelLayout = side.firstElementChild;

    expect(panelLayout?.children).toHaveLength(2);
    expect(panelLayout?.lastElementChild?.contains(groups)).toBe(true);
});

test('DSH-012 shows settled summary after direct-friend expense history', () => {
    resolveDashboardOnboardingData();
    useUsersStore.setState({
        friends: [{
            user: { ...creator, id: 'friend-1' },
            balances: [],
            lastUsedCurrency: 'USD',
        }],
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-summary')).toBeTruthy();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
});

test('DSH-012 hides settled summary without direct-friend or group history', () => {
    resolveDashboardOnboardingData();
    useUsersStore.setState({
        friends: [{
            user: { ...creator, id: 'friend-1' },
            balances: [],
            lastUsedCurrency: null,
        }],
    });

    render(<DashboardPage />);

    expect(screen.queryByTestId('dashboard-summary')).toBeNull();
});

test('DSH-009 renders normal Dashboard for a one-member group with empty activity', () => {
    resolveDashboardOnboardingData();
    useGroupsStore.setState({ groups: [singleMemberGroup] });
    render(<DashboardPage />);

    const main = screen.getByTestId('dashboard-main');
    const sidePanel = screen.getByTestId('dashboard-side-panel');
    expect(within(main).queryByTestId('dashboard-onboarding')).toBeNull();
    expect(within(main).getByTestId('activity-list')).toBeTruthy();
    expect(within(sidePanel).getByTestId('groups-cards').dataset.count).toBe('1');
});

test('DSH-009 renders normal Dashboard for a connected friend with no activity', () => {
    resolveDashboardOnboardingData();
    useUsersStore.setState({ friends: [{ user: creator, balances: [], lastUsedCurrency: null }] });
    render(<DashboardPage />);

    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
});

test('DSH-010 keeps normal Dashboard with a connection and activity', () => {
    resolveDashboardOnboardingData();
    useGroupsStore.setState({ groups: [singleMemberGroup] });
    useDashboardStore.setState({ activityItems: [activityItem] });
    render(<DashboardPage />);

    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
});

test('DSH-007 preserves an existing dashboard after a failed background refresh', () => {
    resolveDashboardOnboardingData();
    useGroupsStore.setState({ groups: [singleMemberGroup] });
    useDashboardStore.setState({
        hasConfirmedDashboardData: true,
        activityItems: [activityItem],
    });
    useErrorsStore.getState().setError('dashboard', 'data', {
        message: 'Background refresh failed',
    });
    const refreshData = vi.fn(() => Promise.resolve());
    useDashboardStore.setState({ fetchSetDashboardData: refreshData });

    render(<DashboardPage />);

    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.getByTestId('groups-cards')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'activity:retryAction' }));
    expect(refreshData).toHaveBeenCalledOnce();
});

test('DSH-007 preserves a confirmed dashboard during background refresh loading', () => {
    resolveDashboardOnboardingData();
    useGroupsStore.setState({ groups: [singleMemberGroup] });
    useDashboardStore.setState({ hasConfirmedDashboardData: true });
    useLoadingStore.getState().setLoading('dashboard', 'data', 'loading');

    render(<DashboardPage />);

    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();
});

test('DSH-007 Retry fetches both dashboard data and currency rates', () => {
    resolveDashboardOnboardingData();
    useErrorsStore.getState().setError('dashboard', 'data', {
        message: 'Dashboard unavailable',
    });
    useErrorsStore.getState().setError('dashboard', 'rates', {
        message: 'Rates unavailable',
    });
    const refreshData = vi.fn(() => Promise.resolve());
    const refreshDashboardOnly = vi.fn(() => Promise.resolve());
    useDashboardStore.setState({
        fetchSetDashboardData: refreshData,
        fetchSetDashboard: refreshDashboardOnly,
    });

    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'activity:retryAction' }));

    expect(refreshData).toHaveBeenCalledOnce();
    expect(refreshDashboardOnly).not.toHaveBeenCalled();
});

test('DSH-007 never mistakes a load failure for new-user welcome', () => {
    resolveDashboardOnboardingData();
    useErrorsStore.getState().setError('users', 'friends', {
        message: 'Friends unavailable',
    });
    render(<DashboardPage />);

    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.queryByTestId('activity-list')).toBeNull();
    expect(screen.getByText('errors.loadTitle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'activity:retryAction' })).toBeTruthy();
});

test('DSH-007 requires a successfully resolved user before welcome', () => {
    resolveDashboardOnboardingData();
    useUsersStore.setState({ user: null });
    render(<DashboardPage />);

    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.getByText('errors.loadTitle')).toBeTruthy();
});

test('DSH-007 derives welcome from connections, not group lifecycle activity', () => {
    resolveDashboardOnboardingData();
    useDashboardStore.setState({ activityItems: [activityItem] });
    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-onboarding')).toBeTruthy();
});

test('DSH-007 ignores currency-rate failure when onboarding data is resolved', () => {
    resolveDashboardOnboardingData();
    useErrorsStore.getState().setError(
        'dashboard',
        'rates',
        {
            message: 'Rates unavailable',
        },
    );

    render(<DashboardPage />);

    expect(
        screen.getByTestId('dashboard-onboarding'),
    ).toBeTruthy();
});

test('DSH-007 keeps loading while connection inputs resolve', () => {
    useLoadingStore
        .getState()
        .setLoading('dashboard', 'data', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('group', 'list', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('users', 'friends', 'fetched');

    render(<DashboardPage />);

    expect(
        screen.getByTestId('activity-skeleton'),
    ).toBeTruthy();
    expect(
        screen.queryByTestId('dashboard-onboarding'),
    ).toBeNull();
    expect(
        screen.queryByTestId('activity-list'),
    ).toBeNull();
});

test('ACT-023 connects dashboard infinite scroll to the next activity preview page', () => {
    useGroupsStore.setState({ groups: [singleMemberGroup] });
    const fetchMoreDashboardActivity = vi.fn(() =>
        Promise.resolve(),
    );
    resolveDashboardOnboardingData();
    useDashboardStore.setState({
        activityItems: [activityItem],
        activityNextCursor: 40,
        fetchMoreDashboardActivity,
    });

    render(<DashboardPage />);

    expect(
        useInfiniteScrollMock,
    ).toHaveBeenLastCalledWith(
        expect.objectContaining({
            hasMore: true,
            isLoading: false,
        }),
    );

    const lastCall =
        useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error(
            'Infinite scroll was not initialized',
        );
    }

    return lastCall[0].onLoadMore().then(() => {
        expect(
            fetchMoreDashboardActivity,
        ).toHaveBeenCalledOnce();
    });
});
