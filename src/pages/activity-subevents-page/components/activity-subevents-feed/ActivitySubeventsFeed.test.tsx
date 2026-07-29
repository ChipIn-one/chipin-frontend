import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { useActivityStore } from 'store/activity-store';
import { useLoadingStore } from 'store/loadingStore';

import { ActivitySubeventsFeed } from './ActivitySubeventsFeed';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

let onLoadMore: (() => Promise<void>) | undefined;

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: ({
        onLoadMore: nextOnLoadMore,
    }: {
        onLoadMore: () => Promise<void>;
    }) => {
        onLoadMore = nextOnLoadMore;
        return vi.fn();
    },
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

beforeEach(() => {
    onLoadMore = undefined;
});

test('waits for the parent category before fetching subevents', () => {
    const fetchSetActivitySubevents = vi.fn().mockResolvedValue(undefined);
    useActivityStore.setState({
        subevents: [],
        subeventsParentId: null,
        fetchSetActivitySubevents,
    });
    useLoadingStore.getState().setInitialLoadingStore();

    const { rerender } = render(
        <ActivitySubeventsFeed parentActivityId="activity-1" />,
    );

    expect(fetchSetActivitySubevents).not.toHaveBeenCalled();

    rerender(
        <ActivitySubeventsFeed
            parentActivityId="activity-1"
            activityCategory={ACTIVITY_CATEGORIES.EXPENSE}
        />,
    );

    return waitFor(() => {
        expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
            parentActivityId: 'activity-1',
            category: ACTIVITY_CATEGORIES.EXPENSE,
        });
    });
});

test('offers retry after the initial subevents request fails', () => {
    const user = userEvent.setup();
    const fetchSetActivitySubevents = vi
        .fn()
        .mockImplementation(() => {
            useActivityStore.setState({
                subeventsParentId: 'activity-1',
            });
            return Promise.reject(new Error('Subevents unavailable'));
        });
    useActivityStore.setState({
        subevents: [],
        hasMoreSubevents: false,
        subeventsParentId: null,
        fetchSetActivitySubevents,
    });
    useLoadingStore.getState().setInitialLoadingStore();

    render(
        <ActivitySubeventsFeed
            parentActivityId="activity-1"
            activityCategory={ACTIVITY_CATEGORIES.EXPENSE}
        />,
    );

    return waitFor(() => {
        expect(screen.getByText('subeventsLoadErrorTitle')).toBeTruthy();
    })
        .then(() => user.click(screen.getByRole('button', { name: 'retryAction' })))
        .then(() => {
            expect(fetchSetActivitySubevents).toHaveBeenCalledTimes(2);
        });
});

test('offers retry after loading the next page fails', () => {
    const user = userEvent.setup();
    const fetchMoreActivitySubevents = vi
        .fn()
        .mockRejectedValueOnce(new Error('Next page unavailable'))
        .mockResolvedValue(undefined);
    useActivityStore.setState({
        subevents: [],
        hasMoreSubevents: true,
        subeventsParentId: 'activity-1',
        fetchMoreActivitySubevents,
    });
    useLoadingStore.getState().setInitialLoadingStore();

    render(
        <ActivitySubeventsFeed
            parentActivityId="activity-1"
            activityCategory={ACTIVITY_CATEGORIES.EXPENSE}
        />,
    );

    if (!onLoadMore) {
        return Promise.reject(new Error('Infinite scroll callback is unavailable'));
    }

    return onLoadMore()
        .catch(() => undefined)
        .then(() =>
            waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'retryAction' }),
                ).toBeTruthy();
            }),
        )
        .then(() =>
            user.click(
                screen.getByRole('button', { name: 'retryAction' }),
            ),
        )
        .then(() => {
            expect(fetchMoreActivitySubevents).toHaveBeenCalledTimes(2);
        });
});
