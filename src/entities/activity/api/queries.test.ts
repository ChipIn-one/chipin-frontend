import * as Sentry from '@sentry/react';
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
import { loadedActivityEvents, loadedActivityPreviews } from '../model/selfActivity';

import {
    activityKeys,
    invalidateSelfActivity,
    selfActivityEventsQueryOptions,
    selfActivityPreviewsQueryOptions,
} from './queries';

vi.mock('@sentry/react', async importOriginal => ({
    ...(await importOriginal<typeof import('@sentry/react')>()),
    captureMessage: vi.fn(),
}));

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

/** Hides and shows the tab while the feed is shown (`show` subscribes) on a mounted client. */
const focusWhileShown = async (
    client: QueryClient,
    show: () => () => void,
    check: () => void | Promise<void>,
) => {
    const unsubscribe = show();

    // Focus events reach the cache of a mounted client only.
    client.mount();
    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await check();
    } finally {
        unsubscribe();
        client.unmount();
        focusManager.setFocused(undefined);
    }
};

const STALE = { updatedAt: Date.now() - 60_000 };

test('a focus refetch of the stale dashboard previews reloads only their first page', async () => {
    const cursors = servePages(PREVIEWS_URL, () => ({
        items: [wirePreview('new')],
        nextCursor: 40,
    }));
    const client = new QueryClient();
    const options = selfActivityPreviewsQueryOptions();

    client.setQueryData<SelfActivityPreviewsData>(
        options.queryKey,
        threePages(previewsPage),
        STALE,
    );

    const show = () =>
        new InfiniteQueryObserver(client, { ...options, refetchOnMount: false }).subscribe(
            () => undefined,
        );

    await focusWhileShown(client, show, async () => {
        await vi.waitFor(() => {
            expect(client.getQueryState(options.queryKey)?.fetchStatus).toBe('idle');
            expect(cursors).toEqual([null]);
        });
        expect(client.getQueryData(options.queryKey)?.pages).toEqual([previewsPage('new', 40)]);
    });
});

test('a focus refetches the stale Activity log while one page is loaded', async () => {
    const cursors = servePages(EVENTS_URL, () => ({ items: [wireEvent('new')], nextCursor: 40 }));
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();

    client.setQueryData<SelfActivityEventsData>(
        options.queryKey,
        { pages: [eventsPage('a', 40)], pageParams: [null] },
        STALE,
    );

    const show = () =>
        new InfiniteQueryObserver(client, { ...options, refetchOnMount: false }).subscribe(
            () => undefined,
        );

    await focusWhileShown(client, show, async () => {
        await vi.waitFor(() => {
            expect(client.getQueryData(options.queryKey)?.pages).toEqual([eventsPage('new', 40)]);
        });
        expect(cursors).toEqual([null]);
    });
});

test('a focus or a reconnect keeps a stale Activity log of several pages: no request, every page stays', async () => {
    const cursors = servePages(EVENTS_URL, () => ({ items: [wireEvent('new')], nextCursor: 40 }));
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();
    const loaded = threePages(eventsPage);

    client.setQueryData<SelfActivityEventsData>(options.queryKey, loaded, STALE);

    const show = () =>
        new InfiniteQueryObserver(client, { ...options, refetchOnMount: false }).subscribe(
            () => undefined,
        );

    await focusWhileShown(client, show, async () => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
        // The client handles focus and online after resuming paused mutations (a microtask later).
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(cursors).toEqual([]);
        expect(client.getQueryState(options.queryKey)?.fetchStatus).toBe('idle');
        expect(client.getQueryData(options.queryKey)).toEqual(loaded);
    });
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

// The same item with a currency that is no ISO code: its amounts cannot be read.
const unreadable = (item: object): unknown =>
    JSON.parse(JSON.stringify(item).split('"currency":"USD"').join('"currency":"EURO"'));

test('an item with an unreadable amount is left out of each feed and reported once by its id only', async () => {
    vi.mocked(Sentry.captureMessage).mockClear();
    servePages(PREVIEWS_URL, () => ({
        items: [unreadable(wirePreview('bad-preview')), wirePreview('ok')],
        nextCursor: null,
    }));
    servePages(EVENTS_URL, () => ({
        items: [wireEvent('ok'), unreadable(wireEvent('bad-event'))],
        nextCursor: null,
    }));
    const client = new QueryClient();

    const previews = await client.fetchInfiniteQuery(selfActivityPreviewsQueryOptions());
    const events = await client.fetchInfiniteQuery(selfActivityEventsQueryOptions());

    expect(previews.pages[0]?.items).toEqual([
        { kind: 'invalid', id: 'bad-preview' },
        domainPreview('ok'),
    ]);
    expect(loadedActivityPreviews(previews)).toEqual([domainPreview('ok')]);
    expect(events.pages[0]?.items).toEqual([
        domainEvent('ok'),
        { kind: 'invalid', id: 'bad-event' },
    ]);
    expect(loadedActivityEvents(events)).toEqual([domainEvent('ok')]);

    // Reading the cached feed again reports nothing more.
    loadedActivityPreviews(previews);
    loadedActivityEvents(events);
    // Only the reason and the item id: no amount, description or name.
    expect(vi.mocked(Sentry.captureMessage).mock.calls).toEqual([
        [
            'money.wire_reject',
            { level: 'error', tags: { 'money.reason': 'shape' }, extra: { itemId: 'bad-preview' } },
        ],
        [
            'money.wire_reject',
            { level: 'error', tags: { 'money.reason': 'shape' }, extra: { itemId: 'bad-event' } },
        ],
    ]);
});

test('a change while the next page loads ends with one first-page request and one page', async () => {
    let releaseNextPage: (() => void) | undefined;
    const nextPageHeld = new Promise<void>(resolve => {
        releaseNextPage = resolve;
    });
    const cursors: (string | null)[] = [];

    server.use(
        http.get(EVENTS_URL, async ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            if (cursor !== null) {
                // The next page that predates the change: answered only after it was cancelled.
                await nextPageHeld;
                return HttpResponse.json({ items: [wireEvent('old-page')], nextCursor: null });
            }
            return HttpResponse.json({ items: [wireEvent('after')], nextCursor: 40 });
        }),
    );
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();

    client.setQueryData<SelfActivityEventsData>(options.queryKey, {
        pages: [eventsPage('a', 40)],
        pageParams: [null],
    });
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    try {
        const nextPage = observer.fetchNextPage();

        await vi.waitFor(() => {
            expect(cursors).toEqual(['40']);
        });
        await invalidateSelfActivity(client);
        releaseNextPage?.();
        await nextPage;

        expect(cursors).toEqual(['40', null]);
        expect(client.getQueryData(options.queryKey)).toEqual({
            pages: [eventsPage('after', 40)],
            pageParams: [null],
        });
        expect(client.getQueryState(options.queryKey)?.fetchStatus).toBe('idle');
    } finally {
        unsubscribe();
    }
});

test('two overlapping changes leave one page from the newest reload and nothing running', async () => {
    let requests = 0;

    server.use(
        http.get(EVENTS_URL, async () => {
            requests += 1;
            const id = `reload-${String(requests)}`;

            await delay(20);
            return HttpResponse.json({ items: [wireEvent(id)], nextCursor: 40 });
        }),
    );
    const client = new QueryClient();
    const options = selfActivityEventsQueryOptions();

    client.setQueryData<SelfActivityEventsData>(options.queryKey, threePages(eventsPage));
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    try {
        await Promise.all([invalidateSelfActivity(client), invalidateSelfActivity(client)]);

        const pages = client.getQueryData(options.queryKey)?.pages;

        // The reload a second change overtook is cancelled; the newest answer is the one kept.
        expect(pages).toEqual([eventsPage(`reload-${String(requests)}`, 40)]);
        expect(requests).toBeLessThanOrEqual(2);
        expect(client.getQueryState(options.queryKey)?.fetchStatus).toBe('idle');
        expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(false);
    } finally {
        unsubscribe();
    }
});
