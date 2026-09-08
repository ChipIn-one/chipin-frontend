import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { useActivityStore } from 'store/activity-store';
import { useErrorsStore } from 'store/errorsStore';
import { useLoadingStore } from 'store/loadingStore';

import { ActivitySubeventsFeed } from './ActivitySubeventsFeed';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

let onLoadMore: (() => Promise<void>) | undefined;
const parentEvent = { id: 'activity-1' } as AppEvent;

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
    useErrorsStore.getState().resetErrors();
});

test('fetches subevents without a category on a direct visit', () => {
    const fetchSetActivitySubevents = vi.fn().mockResolvedValue(undefined);
    useActivityStore.setState({
        subevents: [],
        subeventsParent: null,
        fetchSetActivitySubevents,
    });
    useLoadingStore.getState().setInitialLoadingStore();

    render(
        <ActivitySubeventsFeed parentActivityId="activity-1" />,
    );

    return waitFor(() => {
        expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
            parentActivityId: 'activity-1',
            category: undefined,
        });
    });
});

test('offers retry after the initial subevents request fails', () => {
    const user = userEvent.setup();
    const fetchSetActivitySubevents = vi
        .fn()
        .mockImplementation(() => {
            useErrorsStore.getState().setError('activity', 'subeventsData', {
                message: 'Subevents unavailable',
            });
            return Promise.resolve();
        });
    useActivityStore.setState({
        subevents: [],
        hasMoreSubevents: false,
        subeventsParent: null,
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
        .mockImplementationOnce(() => {
            useErrorsStore.getState().setError('activity', 'subeventsNextPage', {
                message: 'Next page unavailable',
            });
            return Promise.resolve();
        })
        .mockResolvedValue(undefined);
    useActivityStore.setState({
        subevents: [],
        hasMoreSubevents: true,
        subeventsParent: parentEvent,
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

    return Promise.resolve(onLoadMore())
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
