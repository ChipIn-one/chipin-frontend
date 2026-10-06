import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, within } from '@testing-library/react';

import type { ActivityFeedItem, Group } from 'api/chipin.types';
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
    DashboardOnboarding: (props: {
        hasFriendTarget: boolean;
        hasGroupTarget: boolean;
    }) => (
        <div
            data-testid="dashboard-onboarding"
            data-has-friend-target={String(
                props.hasFriendTarget,
            )}
            data-has-group-target={String(
                props.hasGroupTarget,
            )}
        />
    ),
}));

vi.mock('components/dashboard-summary', () => ({
    DashboardHeader: () => null,
    DashboardSummary: () => null,
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

beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.getState().setInitialDashboardStore();
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.setState({ friends: [] });
    useLoadingStore.getState().setInitialLoadingStore();
    useErrorsStore.getState().resetErrors();
});

test('DSH-007 renders onboarding in the main Dashboard column', () => {
    resolveDashboardOnboardingData();

    render(<DashboardPage />);

    const main = screen.getByTestId('dashboard-main');
    const onboarding = within(main).getByTestId(
        'dashboard-onboarding',
    );

    expect(onboarding.dataset.hasFriendTarget).toBe(
        'false',
    );
    expect(onboarding.dataset.hasGroupTarget).toBe(
        'false',
    );
    expect(
        within(main).queryByTestId('activity-list'),
    ).toBeNull();
});

test('DSH-009 treats an existing one-member group as group-ready', () => {
    resolveDashboardOnboardingData();
    useGroupsStore.setState({
        groups: [singleMemberGroup],
    });

    render(<DashboardPage />);

    const main = screen.getByTestId('dashboard-main');
    const sidePanel = screen.getByTestId(
        'dashboard-side-panel',
    );
    const onboarding = within(main).getByTestId(
        'dashboard-onboarding',
    );

    expect(onboarding.dataset.hasGroupTarget).toBe(
        'true',
    );
    expect(
        within(sidePanel).getByTestId('groups-cards')
            .dataset.count,
    ).toBe('1');
    expect(
        within(main).queryByTestId('groups-cards'),
    ).toBeNull();
});

test('DSH-010 renders the regular Dashboard once activity exists', () => {
    resolveDashboardOnboardingData();
    useDashboardStore.setState({
        activityItems: [activityItem],
    });

    render(<DashboardPage />);

    const main = screen.getByTestId('dashboard-main');

    expect(
        within(main).queryByTestId(
            'dashboard-onboarding',
        ),
    ).toBeNull();
    expect(
        within(main).getByTestId('activity-list'),
    ).toBeTruthy();
});

test('DSH-007 does not turn a target-load failure into onboarding', () => {
    resolveDashboardOnboardingData();
    useErrorsStore.getState().setError(
        'users',
        'friends',
        {
            message: 'Friends unavailable',
        },
    );

    render(<DashboardPage />);

    const main = screen.getByTestId('dashboard-main');

    expect(
        within(main).queryByTestId(
            'dashboard-onboarding',
        ),
    ).toBeNull();
    expect(
        within(main).getByTestId('activity-list'),
    ).toBeTruthy();
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

test('DSH-007 keeps loading instead of flashing No activity while onboarding inputs resolve', () => {
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
