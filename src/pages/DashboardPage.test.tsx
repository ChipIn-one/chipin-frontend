import { beforeEach, expect, test, vi } from 'vitest';

import { render } from '@testing-library/react';

import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

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
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: useInfiniteScrollMock,
}));

vi.mock('components/dashboard-summary', () => ({
    DashboardHeader: () => null,
    DashboardSummary: () => null,
}));

vi.mock('components/GroupsCards', () => ({
    default: () => null,
}));

vi.mock('components/GroupsSectionHeader', () => ({
    default: () => null,
}));

vi.mock('components/internal-page-layout', () => ({
    InternalPageColumnsFromSm: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('components/modals', () => ({
    CreateUpdateGroupModal: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.getState().setInitialDashboardStore();
    useGroupsStore.getState().setInitialGroupsStore();
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('dashboard', 'data', 'fetched');
});

test('connects dashboard infinite scroll to the next activity preview page', () => {
    const fetchMoreDashboardActivity = vi.fn(() => Promise.resolve());
    useDashboardStore.setState({
        activityNextCursor: 40,
        fetchMoreDashboardActivity,
    });

    render(<DashboardPage />);

    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: true, isLoading: false }),
    );

    const lastCall = useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error('Infinite scroll was not initialized');
    }

    return lastCall[0].onLoadMore().then(() => {
        expect(fetchMoreDashboardActivity).toHaveBeenCalledOnce();
    });
});
