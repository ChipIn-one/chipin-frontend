import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import type { ActivityHistoryResult } from 'hooks/useActivityHistory';

import { ActivitySubeventsFeed } from './ActivitySubeventsFeed';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: () => vi.fn(),
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="feed-skeleton" />,
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: ({
        children,
        emptyState,
    }: {
        children: ReactNode;
        emptyState: ReactNode;
    }) => (
        <>
            {emptyState}
            {children}
        </>
    ),
}));

const history = (state: Partial<ActivityHistoryResult> = {}): ActivityHistoryResult => ({
    parent: undefined,
    events: [],
    isLoading: false,
    isError: false,
    isOffline: false,
    hasMore: false,
    loadedKey: '1:1',
    isFetching: false,
    isNextPageLoading: false,
    isNextPageError: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
    ...state,
});

test('shows the skeleton while the first load of the history runs', () => {
    render(<ActivitySubeventsFeed history={history({ isLoading: true })} />);

    expect(screen.getByTestId('feed-skeleton')).toBeTruthy();
});

test('offers retry after the first load of the history fails', async () => {
    const user = userEvent.setup();
    const failed = history({ isError: true });

    render(<ActivitySubeventsFeed history={failed} />);

    expect(screen.getByText('subeventsLoadErrorTitle')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'retryAction' }));
    expect(failed.reload).toHaveBeenCalledOnce();
});

test('offline with nothing cached says so, without a retry: the load resumes on reconnect', () => {
    render(<ActivitySubeventsFeed history={history({ isOffline: true })} />);

    expect(screen.getByText('errors:network.offline')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
    expect(screen.queryByText('subeventsLoadErrorTitle')).toBeNull();
});

test('offers retry after loading the next page fails', async () => {
    const user = userEvent.setup();
    const failed = history({ hasMore: true, isNextPageError: true });

    render(<ActivitySubeventsFeed history={failed} />);

    await user.click(screen.getByRole('button', { name: 'retryAction' }));
    expect(failed.loadMore).toHaveBeenCalledOnce();
});

test('a loaded history without later events shows the empty state', () => {
    render(<ActivitySubeventsFeed history={history()} />);

    expect(screen.getByText('subeventsEmptyTitle')).toBeTruthy();
});
