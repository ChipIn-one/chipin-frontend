import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ActivityList from './ActivityList';

const mocks = vi.hoisted(() => ({
    activityState: {
        items: [{ action: 'EXPENSE_CREATED' }],
        hasMore: true,
    },
    loadingState: {
        isLoading: false,
        isNextPageLoading: false,
    },
    errorsState: {
        isNextPageError: false,
    },
    fetchMoreActivity: vi.fn(() => Promise.resolve()),
    useInfiniteScroll: vi.fn(() => vi.fn()),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(selector: T): T => selector,
}));

vi.mock('store/activity-store', () => ({
    selectActivityFeed: (state: typeof mocks.activityState) => ({
        items: state.items,
        hasMore: state.hasMore,
    }),
    useActivityStore: (
        selector: (state: typeof mocks.activityState & {
            fetchMoreActivity: typeof mocks.fetchMoreActivity;
        }) => unknown,
    ) =>
        selector({
            ...mocks.activityState,
            fetchMoreActivity: mocks.fetchMoreActivity,
        }),
}));

vi.mock('store/loadingSelectors', () => ({
    selectActivityLoading: (state: typeof mocks.loadingState) => state.isLoading,
    selectActivityNextPageLoading: (state: typeof mocks.loadingState) =>
        state.isNextPageLoading,
}));

vi.mock('store/loadingStore', () => ({
    useLoadingStore: (
        selector: (state: typeof mocks.loadingState) => unknown,
    ) => selector(mocks.loadingState),
}));

vi.mock('store/errorsSelectors', () => ({
    selectActivityNextPageError: (state: typeof mocks.errorsState) =>
        state.isNextPageError,
}));

vi.mock('store/errorsStore', () => ({
    useErrorsStore: (
        selector: (state: typeof mocks.errorsState) => unknown,
    ) => selector(mocks.errorsState),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: mocks.useInfiniteScroll,
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('./components', () => ({
    ActivityEventsList: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
    ),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.activityState.hasMore = true;
    mocks.loadingState.isLoading = false;
    mocks.loadingState.isNextPageLoading = false;
    mocks.errorsState.isNextPageError = false;
});

test('blocks automatic pagination after an incremental error and allows a manual retry', () => {
    const user = userEvent.setup();
    mocks.errorsState.isNextPageError = true;

    render(
        <Theme>
            <ActivityList activeFilter="all" />
        </Theme>,
    );

    expect(mocks.useInfiniteScroll).toHaveBeenLastCalledWith({
        hasMore: false,
        isLoading: false,
        onLoadMore: mocks.fetchMoreActivity,
    });

    return user
        .click(screen.getByRole('button', { name: 'retryAction' }))
        .then(() => {
            expect(mocks.fetchMoreActivity).toHaveBeenCalledOnce();
        });
});
