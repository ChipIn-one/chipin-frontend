// The Activity page's filter with the real `useInfiniteScroll`: the trigger stays in view while a
// filter matches few of the loaded events, so the feed keeps loading.
import { Theme } from '@radix-ui/themes';
import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { ActivityEvent, SelfActivityEventsData } from 'entities/activity';
import { activityKeys } from 'entities/activity';
import { useAuthStore } from 'store/authStore';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import ActivityList from './ActivityList';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('./components', () => ({
    ActivityEventsList: ({ log }: { log: readonly ActivityEvent[] }) => (
        <ul>
            {log.map(event => (
                <li key={event.id} data-testid="event">
                    {event.id}
                </li>
            ))}
        </ul>
    ),
}));

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

// The scroll trigger (the sentinel under the list) as the browser reports it.
const sentinel = { isIntersecting: true, report: [] as ObserverCallback[] };

class IntersectionObserverMock {
    private readonly callback: ObserverCallback;

    constructor(callback: ObserverCallback) {
        this.callback = callback;
        sentinel.report.push(callback);
    }

    observe(target: Element): void {
        this.callback([
            { isIntersecting: sentinel.isIntersecting, target } as IntersectionObserverEntry,
        ]);
    }

    disconnect(): void {
        sentinel.report = sentinel.report.filter(callback => callback !== this.callback);
    }
}

const server = setupMswServer();

beforeEach(() => {
    sentinel.isIntersecting = true;
    sentinel.report = [];
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    useAuthStore.setState({ status: 'authenticated' });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Three pages of expenses; only the last one carries a settlement.
const wireExpense = (id: string) => wirePreview(id).parent;
const wireSettlement = (id: string) => ({
    ...wireExpense(id),
    action: 'SETTLEMENT_CREATED',
    subjectType: 'settlement',
    metadata: {
        type: 'settlement',
        entryId: `entry-${id}`,
        amount: 5,
        currency: 'USD',
        fromDisplayName: 'Member',
        toDisplayName: 'Owner',
    },
});

const PAGES: Record<string, object> = {
    first: { items: [wireExpense('e1'), wireExpense('e2')], nextCursor: 40 },
    '40': { items: [wireExpense('e3')], nextCursor: 30 },
    '30': { items: [wireExpense('e4'), wireSettlement('s1')], nextCursor: 20 },
    '20': { items: [wireExpense('e5')], nextCursor: null },
};

const serveFeed = (onRequest: (cursor: string | null) => void = () => undefined) => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/users/self/activities', ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            onRequest(cursor);
            return HttpResponse.json(PAGES[cursor ?? 'first']);
        }),
    );
    return cursors;
};

const renderSettlements = (client = createTestQueryClient()) => {
    mountAsUserClient('user-1', client);
    return renderWithQueryClient(
        <Theme>
            <ActivityList activeFilter="settlements" />
        </Theme>,
        client,
    );
};

const shownEvents = () => screen.queryAllByTestId('event').map(item => item.textContent);

test('a filter matching few events keeps loading while the trigger is in view, to the end of the feed', async () => {
    const cursors = serveFeed();

    renderSettlements();

    // Four page loads in a row: more than the default 1 s on a loaded machine.
    await waitFor(
        () => {
            expect(screen.getByText('endOfFeed')).toBeTruthy();
        },
        { timeout: 5000 },
    );
    // One request per page, each cursor once.
    expect(cursors).toEqual([null, '40', '30', '20']);
    expect(shownEvents()).toEqual(['s1']);
});

test('a refetch that lands while the next page is in flight leaves the trigger armed, to the end of the feed', async () => {
    const client = createTestQueryClient();
    let isInvalidated = false;
    // A write completes while page 2 is in flight: the invalidation cancels that page and loads
    // the first one again, so the loaded page count stays at 1.
    const cursors = serveFeed(cursor => {
        if (cursor === '40' && !isInvalidated) {
            isInvalidated = true;
            void client.invalidateQueries({ queryKey: activityKeys.all });
        }
    });

    renderSettlements(client);

    // The requests are compared inside the wait: a stopped feed fails on the list it got to.
    await waitFor(
        () => {
            expect(cursors).toEqual([null, '40', null, '40', '30', '20']);
            expect(screen.getByText('endOfFeed')).toBeTruthy();
        },
        { timeout: 5000 },
    );
    expect(shownEvents()).toEqual(['s1']);
}, 10_000);

test('the filter stops loading once the matching rows push the trigger out of view', async () => {
    // The rows of the page with the settlement fill the screen: while that page loads, the
    // browser reports the trigger out of view.
    const cursors = serveFeed(cursor => {
        if (cursor === '30') {
            act(() => {
                sentinel.isIntersecting = false;
                sentinel.report.forEach(report => {
                    report([{ isIntersecting: false } as IntersectionObserverEntry]);
                });
            });
        }
    });

    renderSettlements();

    await waitFor(() => {
        expect(shownEvents()).toEqual(['s1']);
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(cursors).toEqual([null, '40', '30']);
    expect(screen.queryByText('endOfFeed')).toBeNull();
});

test('a next page paused offline is requested once while offline, then appended once on reconnect', async () => {
    const FEED_KEY = activityKeys.self({ view: 'events' });
    const client = createTestQueryClient();
    let isBack = false;
    const cursors: (string | null)[] = [];

    // As in production (`createQueryClient`): the first attempt is sent offline, its retry pauses.
    client.setQueryDefaults(activityKeys.all, {
        networkMode: 'offlineFirst',
        retry: 1,
        retryDelay: 0,
    });
    client.setQueryData<SelfActivityEventsData>(FEED_KEY, {
        pages: [{ items: [domainPreview('a').parent], nextCursor: 40 }],
        pageParams: [null],
    });
    server.use(
        http.get('*/users/self/activities', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'));
            return isBack
                ? HttpResponse.json({ items: [wireExpense('b')], nextCursor: null })
                : HttpResponse.error();
        }),
    );
    mountAsUserClient('user-1', client);
    onlineManager.setOnline(false);

    try {
        renderWithQueryClient(
            <Theme>
                <ActivityList activeFilter="all" />
            </Theme>,
            client,
        );

        await waitFor(
            () => {
                expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');
            },
            { timeout: 5000 },
        );
        // The trigger stays in view: the paused load is left alone, not sent again and again.
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(cursors).toEqual(['40']);
        expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');
        expect(shownEvents()).toEqual(['a']);
        expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
        // Waiting for the network shows no spinner.
        expect(document.querySelector('.rt-Spinner')).toBeNull();

        isBack = true;
        act(() => {
            onlineManager.setOnline(true);
        });

        await waitFor(
            () => {
                expect(shownEvents()).toEqual(['a', 'b']);
            },
            { timeout: 5000 },
        );
        expect(cursors).toEqual(['40', '40']);
        expect(client.getQueryData<SelfActivityEventsData>(FEED_KEY)?.pages).toHaveLength(2);
        expect(screen.getByText('endOfFeed')).toBeTruthy();
    } finally {
        onlineManager.setOnline(true);
    }
});
