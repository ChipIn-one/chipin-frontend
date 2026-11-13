import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { ActivityEvent, SelfActivityEventsData } from 'entities/activity';
import { activityKeys } from 'entities/activity';
import { currencyCode, fromUnits } from 'shared/money';
import { useAuthStore } from 'store/authStore';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import type { ActivityFilter } from './ActivityHeader';
import ActivityList from './ActivityList';

const useInfiniteScrollMock = vi.hoisted(() =>
    vi.fn<(params: { hasMore: boolean; isLoading: boolean; onLoadMore: () => void }) => () => void>(
        () => vi.fn(),
    ),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: useInfiniteScrollMock,
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('./components', () => ({
    ActivityEventsList: ({ log }: { log: readonly ActivityEvent[] }) =>
        log.length === 0 ? (
            <div data-testid="empty-state" />
        ) : (
            <ul>
                {log.map(event => (
                    <li key={event.id} data-testid="event">
                        {event.id}
                    </li>
                ))}
            </ul>
        ),
}));

const server = setupMswServer();
const EVENTS_URL = '*/users/self/activities';
const FEED_KEY = activityKeys.self({ view: 'events' });

// A flat event on the wire and in the domain: the creation event of an expense chain.
const wireEvent = (id: string) => wirePreview(id).parent;
const expense = (id: string): ActivityEvent => domainPreview(id).parent;
const settlement = (id: string): ActivityEvent => ({
    ...expense(id),
    action: 'SETTLEMENT_CREATED',
    metadata: {
        type: 'settlement',
        entryId: `entry-${id}`,
        amount: fromUnits(50_000n, currencyCode('USD')),
        fromDisplayName: 'Member',
        toDisplayName: 'Owner',
    },
});
const groupCreated = (id: string): ActivityEvent => ({
    ...expense(id),
    domain: 'GROUP',
    action: 'GROUP_CREATED',
    metadata: { type: 'group', groupId: 'group-1', groupName: 'Trip' },
});

let client: QueryClient;

beforeEach(() => {
    vi.clearAllMocks();
    client = createTestQueryClient();
    mountAsUserClient('user-1', client);
    useAuthStore.setState({ status: 'authenticated' });
});

/** The feed as a restored cache or a finished load leaves it (fresh unless `updatedAt` is old). */
const seedFeed = (
    items: ActivityEvent[],
    nextCursor: number | null = null,
    updatedAt: number = Date.now(),
) => {
    client.setQueryData<SelfActivityEventsData>(
        FEED_KEY,
        { pages: [{ items, nextCursor }], pageParams: [null] },
        { updatedAt },
    );
};

/** Answers the feed with `respond` and records its requests. */
const serveFeed = (respond: (cursor: string | null) => Response | Promise<Response>) => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get(EVENTS_URL, ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            return respond(cursor);
        }),
    );
    return cursors;
};

const badRequest = () =>
    HttpResponse.json({ code: 'SYSTEM.BAD_REQUEST', message: 'Unavailable' }, { status: 400 });

const renderList = (activeFilter: ActivityFilter = 'all', on: QueryClient = client) =>
    renderWithQueryClient(
        <Theme>
            <ActivityList activeFilter={activeFilter} />
        </Theme>,
        on,
    );

const shownEvents = () => screen.queryAllByTestId('event').map(item => item.textContent);

const loadMore = () => {
    const lastCall = useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error('Infinite scroll was not initialized');
    }
    act(() => {
        lastCall[0].onLoadMore();
    });
};

test('the first load shows the skeleton, then the feed as domain events', async () => {
    const cursors = serveFeed(() =>
        HttpResponse.json({ items: [wireEvent('a'), wireEvent('b')], nextCursor: null }),
    );

    renderList();

    expect(screen.getByTestId('activity-skeleton')).toBeTruthy();
    await waitFor(() => {
        expect(shownEvents()).toEqual(['a', 'b']);
    });
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();
    expect(cursors).toEqual([null]);
});

test('a cached feed shows at once on reload and refreshes without a skeleton', async () => {
    let answer: (() => void) | undefined;
    const answered = new Promise<void>(resolve => {
        answer = resolve;
    });

    // The restored cache is older than the 30 s staleTime: the mount refreshes it.
    seedFeed([expense('cached')], null, 0);
    serveFeed(async () => {
        await answered;
        return HttpResponse.json({ items: [wireEvent('fresh')], nextCursor: null });
    });

    renderList();

    expect(shownEvents()).toEqual(['cached']);
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();
    await waitFor(() => {
        expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('fetching');
    });
    // Still the cached feed while the refresh runs.
    expect(shownEvents()).toEqual(['cached']);
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();

    answer?.();
    await waitFor(() => {
        expect(shownEvents()).toEqual(['fresh']);
    });
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();
});

test('ACT-020 scrolling loads the next page by its cursor and the last page shows the end of the feed', async () => {
    seedFeed([expense('a')], 40);
    const cursors = serveFeed(() =>
        HttpResponse.json({ items: [wireEvent('b')], nextCursor: null }),
    );

    renderList();

    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: true, isLoading: false }),
    );
    expect(screen.queryByText('endOfFeed')).toBeNull();

    loadMore();

    await waitFor(() => {
        expect(shownEvents()).toEqual(['a', 'b']);
    });
    expect(cursors).toEqual(['40']);
    expect(screen.getByText('endOfFeed')).toBeTruthy();
    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: false }),
    );
});

test('the Expenses and Settlements filters narrow the loaded events', () => {
    seedFeed([expense('expense-1'), settlement('settlement-1'), groupCreated('group-created')]);

    const all = renderList('all');

    expect(shownEvents()).toEqual(['expense-1', 'settlement-1', 'group-created']);
    all.unmount();

    const expenses = renderList('expenses');

    expect(shownEvents()).toEqual(['expense-1']);
    expenses.unmount();

    renderList('settlements');
    expect(shownEvents()).toEqual(['settlement-1']);
});

test('keeps pagination recovery available when the active filter has no loaded matches', async () => {
    const user = userEvent.setup();

    seedFeed([expense('a')], 40);
    const cursors = serveFeed(badRequest);

    renderList('settlements');
    expect(screen.getByTestId('empty-state')).toBeTruthy();

    loadMore();

    const retry = await screen.findByRole('button', { name: 'retryAction' });

    // A failed next page stops the scroll trigger until Retry.
    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: false, isLoading: false }),
    );
    expect(screen.getByTestId('empty-state')).toBeTruthy();

    await user.click(retry);
    await waitFor(() => {
        expect(cursors).toEqual(['40', '40']);
    });
});

test('a failed first load shows the load error, not "no activity", and Retry loads the feed', async () => {
    const user = userEvent.setup();
    let requests = 0;

    serveFeed(() => {
        requests += 1;
        return requests === 1
            ? badRequest()
            : HttpResponse.json({ items: [wireEvent('a')], nextCursor: null });
    });

    renderList();

    expect(await screen.findByText('loadErrorTitle')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'retryAction' }));
    await waitFor(() => {
        expect(shownEvents()).toEqual(['a']);
    });
    expect(screen.queryByText('loadErrorTitle')).toBeNull();
    expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
});

test('offline with nothing cached, the first load shows the no-connection state without Retry', async () => {
    // The first attempt fails and its retry waits for the network (as `queryRetry` does).
    client.setQueryDefaults(activityKeys.all, { retry: 1, retryDelay: 0 });
    onlineManager.setOnline(false);
    serveFeed(() => HttpResponse.error());

    try {
        renderList();

        expect(await screen.findByText('errors:network.offline')).toBeTruthy();
        expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');
        expect(screen.queryByTestId('empty-state')).toBeNull();
        expect(screen.queryByText('loadErrorTitle')).toBeNull();
        expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
    } finally {
        onlineManager.setOnline(true);
    }
});

test('the offline first-load state clears by itself on reconnect: the skeleton, then the feed', async () => {
    let isBack = false;
    let answer: (() => void) | undefined;
    const answered = new Promise<void>(resolve => {
        answer = resolve;
    });

    client.setQueryDefaults(activityKeys.all, { retry: 1, retryDelay: 0 });
    onlineManager.setOnline(false);
    serveFeed(async () => {
        if (!isBack) {
            return HttpResponse.error();
        }
        await answered;
        return HttpResponse.json({ items: [wireEvent('a')], nextCursor: null });
    });

    try {
        renderList();
        expect(await screen.findByText('errors:network.offline')).toBeTruthy();

        isBack = true;
        act(() => {
            onlineManager.setOnline(true);
        });

        // The paused load resumes without a click.
        expect(await screen.findByTestId('activity-skeleton')).toBeTruthy();
        expect(screen.queryByText('errors:network.offline')).toBeNull();

        answer?.();
        await waitFor(() => {
            expect(shownEvents()).toEqual(['a']);
        });
        expect(screen.queryByTestId('activity-skeleton')).toBeNull();
    } finally {
        onlineManager.setOnline(true);
    }
});

// On the test client (`networkMode: 'online'`) the load pauses before any request; the production
// mode (`offlineFirst`, with the real scroll trigger) is covered in `ActivityList.scroll.test.tsx`.
test('a next page paused offline resumes on reconnect and is appended once', async () => {
    seedFeed([expense('a')], 40);
    onlineManager.setOnline(false);
    const cursors = serveFeed(() =>
        HttpResponse.json({ items: [wireEvent('b')], nextCursor: null }),
    );

    try {
        renderList();
        loadMore();

        await waitFor(() => {
            expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');
        });
        // The loaded page stays, with no error and no Retry: the load waits for the network.
        expect(shownEvents()).toEqual(['a']);
        expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();

        expect(cursors).toEqual([]);
        act(() => {
            onlineManager.setOnline(true);
        });

        await waitFor(() => {
            expect(shownEvents()).toEqual(['a', 'b']);
        });
        // One request: the page is appended once.
        expect(cursors).toEqual(['40']);
        expect(client.getQueryData<SelfActivityEventsData>(FEED_KEY)?.pages).toHaveLength(2);
        expect(screen.getByText('endOfFeed')).toBeTruthy();
    } finally {
        onlineManager.setOnline(true);
    }
});

test('a loaded feed without events shows "no activity", not an error', async () => {
    serveFeed(() => HttpResponse.json({ items: [], nextCursor: null }));

    renderList();

    expect(await screen.findByTestId('empty-state')).toBeTruthy();
    expect(screen.queryByText('loadErrorTitle')).toBeNull();
    expect(screen.queryByText('errors:network.offline')).toBeNull();
    expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
});

test('a repeated scroll trigger while the next page loads sends one request and appends the page once', async () => {
    let answer: (() => void) | undefined;
    const answered = new Promise<void>(resolve => {
        answer = resolve;
    });

    seedFeed([expense('a')], 40);
    const cursors = serveFeed(async cursor => {
        await answered;
        return HttpResponse.json({
            items: [wireEvent('b')],
            nextCursor: cursor === '40' ? 30 : null,
        });
    });

    renderList();
    loadMore();
    await waitFor(() => {
        expect(cursors).toEqual(['40']);
    });
    // The trigger fires again (the latest callback, as a rerender leaves it) while the page loads.
    loadMore();
    loadMore();
    answer?.();

    await waitFor(() => {
        expect(shownEvents()).toEqual(['a', 'b']);
    });
    expect(cursors).toEqual(['40']);
    expect(client.getQueryData<SelfActivityEventsData>(FEED_KEY)?.pages).toHaveLength(2);
});

test('a scroll trigger while the feed refreshes waits: no next-page request until the refresh ends', async () => {
    let answer: (() => void) | undefined;
    const answered = new Promise<void>(resolve => {
        answer = resolve;
    });

    // Stale: the mount refreshes the first page.
    seedFeed([expense('cached')], 40, 0);
    const cursors = serveFeed(async () => {
        await answered;
        return HttpResponse.json({ items: [wireEvent('fresh')], nextCursor: 40 });
    });

    renderList();
    await waitFor(() => {
        expect(cursors).toEqual([null]);
    });
    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isLoading: true }),
    );
    loadMore();
    answer?.();

    await waitFor(() => {
        expect(shownEvents()).toEqual(['fresh']);
    });
    expect(cursors).toEqual([null]);
    expect(client.getQueryData<SelfActivityEventsData>(FEED_KEY)?.pages).toHaveLength(1);
});

test('leaving the page cuts the loaded feed to its first page', () => {
    client.setQueryData<SelfActivityEventsData>(FEED_KEY, {
        pages: [
            { items: [expense('a')], nextCursor: 40 },
            { items: [expense('b')], nextCursor: 30 },
            { items: [expense('c')], nextCursor: null },
        ],
        pageParams: [null, 40, 30],
    });

    const view = renderList();

    expect(shownEvents()).toEqual(['a', 'b', 'c']);
    view.unmount();

    expect(client.getQueryData<SelfActivityEventsData>(FEED_KEY)).toEqual({
        pages: [{ items: [expense('a')], nextCursor: 40 }],
        pageParams: [null],
    });
});

test('offline, the cached feed shows without a skeleton or an error', async () => {
    seedFeed([expense('cached')], 40, 0);
    // The refresh of the mount fails and its retry waits for the network (as `queryRetry` does).
    client.setQueryDefaults(activityKeys.all, { retry: 1, retryDelay: 0 });
    onlineManager.setOnline(false);
    serveFeed(() => HttpResponse.error());

    try {
        renderList();

        await waitFor(() => {
            expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');
        });
        expect(shownEvents()).toEqual(['cached']);
        // Only the OfflineBanner (in the layout) says that the data may be old.
        expect(screen.queryByTestId('activity-skeleton')).toBeNull();
        expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
    } finally {
        onlineManager.setOnline(true);
    }
});

test("signed out, the previous user's cached feed is not shown and nothing is requested", () => {
    const cursors = serveFeed(() => HttpResponse.json({ items: [], nextCursor: null }));

    seedFeed([expense('previous-user')], null, 0);
    useAuthStore.setState({ status: 'unauthenticated' });

    renderList();

    expect(shownEvents()).toEqual([]);
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();
    expect(cursors).toEqual([]);
});

test("after an account switch, a client that is not the user's own is never read or loaded", () => {
    const cursors = serveFeed(() => HttpResponse.json({ items: [], nextCursor: null }));
    // Not registered as a user's persisted client (the anonymous client, or another user's).
    const otherClient = createTestQueryClient();

    otherClient.setQueryData<SelfActivityEventsData>(FEED_KEY, {
        pages: [{ items: [expense('previous-user')], nextCursor: null }],
        pageParams: [null],
    });

    renderList('all', otherClient);

    // The signed-in user's feed is still to come from their own client.
    expect(shownEvents()).toEqual([]);
    expect(screen.getByTestId('activity-skeleton')).toBeTruthy();
    expect(cursors).toEqual([]);
});
