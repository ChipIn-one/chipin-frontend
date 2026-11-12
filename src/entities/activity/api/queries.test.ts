import {
    dehydrate,
    focusManager,
    InfiniteQueryObserver,
    onlineManager,
    QueryClient,
} from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { dehydrateOptions, trimInfinitePages } from 'shared/offline/queryPersister';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { setupMswServer } from 'test/mswServer';

import type { SelfActivityEventsData, SelfActivityPreviewsData } from '../model/selfActivity';

import {
    activityKeys,
    invalidateSelfActivity,
    selfActivityEventsQueryOptions,
    selfActivityPreviewsQueryOptions,
} from './queries';

const server = setupMswServer();

const PREVIEWS_URL = '*/users/self/activity-previews';
const EVENTS_URL = '*/users/self/activities';

// A flat event on the wire and in the domain: the creation event of a preview.
const wireEvent = (id: string) => wirePreview(id).parent;
const domainEvent = (id: string) => domainPreview(id).parent;

const previewsPage = (id: string, nextCursor: number | null) => ({
    items: [domainPreview(id)],
    nextCursor,
});
const eventsPage = (id: string, nextCursor: number | null) => ({
    items: [domainEvent(id)],
    nextCursor,
});

/** Answers `url` with a page per request and records the cursors asked for. */
const servePages = (url: string, respond: (cursor: string | null) => object) => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get(url, ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            return HttpResponse.json(respond(cursor));
        }),
    );
    return cursors;
};

const threePages = <P>(page: (id: string, nextCursor: number | null) => P) => ({
    pages: [page('a', 40), page('b', 30), page('c', null)],
    pageParams: [null, 40, 30],
});

test("the feeds of the user's own activity share the ['activity','self'] root and stay fresh for 30 s", () => {
    expect(activityKeys.all).toEqual(['activity']);
    expect(activityKeys.self()).toEqual(['activity', 'self']);
    expect(selfActivityPreviewsQueryOptions().queryKey).toEqual([
        'activity',
        'self',
        { view: 'previews' },
    ]);
    expect(selfActivityEventsQueryOptions().queryKey).toEqual([
        'activity',
        'self',
        { view: 'events' },
    ]);
    expect(selfActivityPreviewsQueryOptions().staleTime).toBe(30_000);
    expect(selfActivityEventsQueryOptions().staleTime).toBe(30_000);
});

test('ACT-023 pages the previews by cursor to the end of the feed and persists only the first page', async () => {
    const limits: (string | null)[] = [];
    const cursors: (string | null)[] = [];

    server.use(
        http.get(PREVIEWS_URL, ({ request }) => {
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            cursors.push(cursor);
            limits.push(url.searchParams.get('limit'));
            return HttpResponse.json(
                cursor === null
                    ? { items: [wirePreview('a')], nextCursor: 40 }
                    : { items: [wirePreview('b')], nextCursor: null },
            );
        }),
    );
    const client = new QueryClient();
    const options = selfActivityPreviewsQueryOptions();
    const observer = new InfiniteQueryObserver(client, options);

    await observer.refetch();
    expect(observer.getCurrentResult().hasNextPage).toBe(true);
    await observer.fetchNextPage();

    expect(cursors).toEqual([null, '40']);
    expect(limits).toEqual(['20', '20']);
    // The domain items (amounts as `Money`), and no page after the last one.
    expect(client.getQueryData(options.queryKey)?.pages).toEqual([
        previewsPage('a', 40),
        previewsPage('b', null),
    ]);
    expect(observer.getCurrentResult().hasNextPage).toBe(false);

    const persisted = trimInfinitePages({
        timestamp: 0,
        buster: '',
        clientState: dehydrate(client, dehydrateOptions),
    });

    expect(persisted.clientState.queries[0]?.state.data).toEqual({
        pages: [previewsPage('a', 40)],
        pageParams: [null],
    });
});

test('ACT-020 pages the flat log by cursor to the end of the feed as domain events', async () => {
    const cursors = servePages(EVENTS_URL, cursor =>
        cursor === null
            ? { items: [wireEvent('a'), wireEvent('b')], nextCursor: 40 }
            : { items: [wireEvent('c')], nextCursor: null },
    );
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();
    const observer = new InfiniteQueryObserver(client, options);

    await observer.refetch();
    await observer.fetchNextPage();

    expect(cursors).toEqual([null, '40']);
    expect(client.getQueryData(options.queryKey)?.pages).toEqual([
        { items: [domainEvent('a'), domainEvent('b')], nextCursor: 40 },
        { items: [domainEvent('c')], nextCursor: null },
    ]);
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
});

test('reads the amounts of the flat log through the lossless transport as Money', async () => {
    const body = JSON.stringify({ items: [wireEvent('a')], nextCursor: null }).replace(
        '"amount":10,',
        '"amount":365963032346.3555,',
    );

    server.use(
        http.get(
            EVENTS_URL,
            () => new HttpResponse(body, { headers: { 'Content-Type': 'application/json' } }),
        ),
    );
    // The shares no longer add up to the amount; the mapper reads each amount as it is.
    const data = await new QueryClient().fetchInfiniteQuery(selfActivityEventsQueryOptions());
    const [event] = data.pages[0]?.items ?? [];

    expect(event && 'metadata' in event && event.metadata).toMatchObject({
        amount: fromUnits(3_659_630_323_463_555n, currencyCode('USD')),
    });
});

test("#669 a feed load writes its own cache entry only, no other query's", async () => {
    servePages(PREVIEWS_URL, () => ({ items: [wirePreview('a')], nextCursor: 40 }));
    servePages(EVENTS_URL, () => ({ items: [wireEvent('a')], nextCursor: 40 }));
    const client = new QueryClient();
    const keys = () =>
        client
            .getQueryCache()
            .getAll()
            .map(query => query.queryKey);

    await client.fetchInfiniteQuery(selfActivityPreviewsQueryOptions());
    expect(keys()).toEqual([selfActivityPreviewsQueryOptions().queryKey]);

    await client.fetchInfiniteQuery(selfActivityEventsQueryOptions());
    expect(keys()).toEqual([
        selfActivityPreviewsQueryOptions().queryKey,
        selfActivityEventsQueryOptions().queryKey,
    ]);
});

test('a focus refetch of a stale feed reloads only its first page', async () => {
    const cursors = servePages(EVENTS_URL, () => ({ items: [wireEvent('new')], nextCursor: 40 }));
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();

    // Older than the 30 s staleTime.
    client.setQueryData<SelfActivityEventsData>(options.queryKey, threePages(eventsPage), {
        updatedAt: Date.now() - 60_000,
    });
    const observer = new InfiniteQueryObserver(client, { ...options, refetchOnMount: false });
    const unsubscribe = observer.subscribe(() => undefined);

    // Focus events reach the cache of a mounted client only.
    client.mount();
    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);

        await vi.waitFor(() => {
            expect(client.getQueryState(options.queryKey)?.fetchStatus).toBe('idle');
            expect(cursors).toEqual([null]);
        });
        expect(client.getQueryData(options.queryKey)?.pages).toEqual([eventsPage('new', 40)]);
    } finally {
        unsubscribe();
        client.unmount();
        focusManager.setFocused(undefined);
    }
});

test('a focus while the feed is fresh keeps every loaded page', () => {
    const client = new QueryClient();
    const options = selfActivityPreviewsQueryOptions();

    client.setQueryData<SelfActivityPreviewsData>(options.queryKey, threePages(previewsPage));
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    client.mount();
    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);

        expect(client.getQueryData(options.queryKey)?.pages).toHaveLength(3);
    } finally {
        unsubscribe();
        client.unmount();
        focusManager.setFocused(undefined);
    }
});

test('offline, a focus keeps every loaded page of a stale feed', async () => {
    server.use(http.get(PREVIEWS_URL, () => HttpResponse.error()));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = selfActivityPreviewsQueryOptions();

    client.setQueryData<SelfActivityPreviewsData>(options.queryKey, threePages(previewsPage), {
        updatedAt: Date.now() - 60_000,
    });
    const observer = new InfiniteQueryObserver(client, { ...options, refetchOnMount: false });
    const unsubscribe = observer.subscribe(() => undefined);

    client.mount();
    onlineManager.setOnline(false);
    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        // The client handles focus after resuming paused mutations (a microtask later).
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(client.getQueryData(options.queryKey)?.pages).toHaveLength(3);
    } finally {
        unsubscribe();
        client.unmount();
        onlineManager.setOnline(true);
        focusManager.setFocused(undefined);
    }
});

test('after a change, a shown feed of three pages reloads with one request and a hidden one is only marked stale', async () => {
    const previewCursors = servePages(PREVIEWS_URL, () => ({
        items: [wirePreview('new')],
        nextCursor: 40,
    }));
    const eventCursors = servePages(EVENTS_URL, () => ({ items: [], nextCursor: null }));
    const client = new QueryClient();
    const previews = selfActivityPreviewsQueryOptions();
    const events = selfActivityEventsQueryOptions();

    client.setQueryData<SelfActivityPreviewsData>(previews.queryKey, threePages(previewsPage));
    client.setQueryData<SelfActivityEventsData>(events.queryKey, threePages(eventsPage));
    // The dashboard is open (its feed is shown); the Activity page is not.
    const observer = new InfiniteQueryObserver(client, previews);
    const unsubscribe = observer.subscribe(() => undefined);

    try {
        await invalidateSelfActivity(client);

        expect(previewCursors).toEqual([null]);
        expect(client.getQueryData(previews.queryKey)).toEqual({
            pages: [previewsPage('new', 40)],
            pageParams: [null],
        });
        expect(eventCursors).toEqual([]);
        expect(client.getQueryState(events.queryKey)?.isInvalidated).toBe(true);
        expect(client.getQueryData(events.queryKey)?.pages).toEqual([eventsPage('a', 40)]);
    } finally {
        unsubscribe();
    }
});

test('a first load running during a change is cancelled and sent again, so the feed is not older than the change', async () => {
    let requests = 0;

    server.use(
        http.get(EVENTS_URL, async () => {
            requests += 1;
            if (requests === 1) {
                // The load that predates the change: it never answers before it is cancelled.
                await delay('infinite');
            }
            return HttpResponse.json({ items: [wireEvent('after')], nextCursor: null });
        }),
    );
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    try {
        await vi.waitFor(() => {
            expect(requests).toBe(1);
        });
        await invalidateSelfActivity(client);

        expect(requests).toBe(2);
        expect(client.getQueryData(options.queryKey)?.pages).toEqual([eventsPage('after', null)]);
    } finally {
        unsubscribe();
    }
});
