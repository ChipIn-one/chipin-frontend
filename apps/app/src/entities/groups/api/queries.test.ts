import { createElement, type ReactNode } from 'react';
import {
    dehydrate,
    hashKey,
    hydrate,
    InfiniteQueryObserver,
    onlineManager,
    QueryClient,
    QueryClientProvider,
    QueryObserver,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, onTestFinished, test, vi } from 'vitest';

import { ApiError } from 'shared/api/client';
import { createQueryClient, PAGE_LOADED_AT, refetchIfRestored } from 'shared/api/queryClient';
import { dehydrateOptions, trimInfinitePages } from 'shared/offline/queryPersister';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { testGroup, wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';

import { flattenGroupActivity, type GroupActivityData } from '../model/groupActivity';
import { flattenGroupsList, type GroupsListData, upsertGroupInList } from '../model/groupsList';
import type { Group } from '../model/types';

import {
    groupActivityQueryOptions,
    groupDetailQueryOptions,
    groupsKeys,
    groupsListQueryOptions,
    isGroupDeniedError,
    useGroupActivityQuery,
    useGroupDetailQuery,
} from './queries';

const server = setupMswServer();

const group = (id: string, name = `Group ${id}`): Group => testGroup(id, { name });

const listData = (...pages: Group[][]): GroupsListData => ({
    pages: pages.map((items, index) => ({
        items,
        nextCursor: index < pages.length - 1 ? `cursor-${String(index + 1)}` : null,
    })),
    pageParams: pages.map((_items, index) => (index === 0 ? null : `cursor-${String(index)}`)),
});

test("groups keys share the 'groups' root and the list stays fresh for 60 s", () => {
    expect(groupsKeys.all).toEqual(['groups']);
    expect(groupsKeys.list()).toEqual(['groups', 'list']);
    expect(groupsKeys.detail('g-1')).toEqual(['groups', 'detail', 'g-1']);
    expect(groupsKeys.activity('g-1')).toEqual(['groups', 'activity', 'g-1']);
    expect(groupsListQueryOptions().staleTime).toBe(60_000);
});

test('pages the list by its opaque cursor and persists only the first page', async () => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/groups', ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            return HttpResponse.json(
                cursor === null
                    ? { items: [wireGroup('a')], nextCursor: 'opaque:b' }
                    : { items: [wireGroup('b')], nextCursor: null },
            );
        }),
    );
    const client = new QueryClient();
    const observer = new InfiniteQueryObserver(client, groupsListQueryOptions());

    await observer.refetch();
    await observer.fetchNextPage();

    expect(cursors).toEqual([null, 'opaque:b']);
    const persisted = trimInfinitePages({
        timestamp: 0,
        buster: '',
        clientState: dehydrate(client, dehydrateOptions),
    });

    expect(persisted.clientState.queries[0]?.state.data).toEqual({
        pages: [{ items: [group('a')], nextCursor: 'opaque:b' }],
        pageParams: [null],
    });
});

test('reads one list without duplicates, a repeated group keeping its first place', () => {
    const first = group('a', 'First copy');

    expect(
        flattenGroupsList(listData([first, group('b')], [group('a', 'Later'), group('c')])),
    ).toEqual([first, group('b'), group('c')]);
});

test('replaces a listed group in place and adds an unlisted one at the end', () => {
    const renamed = group('a', 'Renamed');
    const data = listData([group('a'), group('b')], [group('c')]);

    expect(upsertGroupInList(data, renamed).pages.map(page => page.items)).toEqual([
        [renamed, group('b')],
        [group('c')],
    ]);
    expect(upsertGroupInList(data, group('d')).pages.map(page => page.items)).toEqual([
        [group('a'), group('b')],
        [group('c'), group('d')],
    ]);
    expect(upsertGroupInList(data, group('d')).pageParams).toBe(data.pageParams);
});

const preview = (parentId: string, seq = 1) => domainPreview(parentId, { seq });

const seededListClient = (groups: Group[], updatedAt: number): QueryClient => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(groupsKeys.list(), listData(groups), { updatedAt });
    return client;
};

// The list, the group's activity and every other cache entry but the detail, as a snapshot.
const otherEntries = (client: QueryClient, groupId: string) =>
    client
        .getQueryCache()
        .getAll()
        .filter(query => query.queryHash !== hashKey(groupsKeys.detail(groupId)))
        .map(query => ({
            key: query.queryKey,
            data: query.state.data,
            at: query.state.dataUpdatedAt,
        }));

test('#669 a group detail read writes no other cache: the list and the activity stay as they were', async () => {
    server.use(
        http.get('*/groups/a', () =>
            HttpResponse.json(
                wireGroup('a', {
                    name: 'Read',
                    recentActivities: { items: [wirePreview('p1')], nextCursor: 7 },
                }),
            ),
        ),
    );
    const client = seededListClient([group('a'), group('b')], Date.now() - 1_000);
    const before = otherEntries(client, 'a');
    const setQueryData = vi.spyOn(client, 'setQueryData');
    const cancelQueries = vi.spyOn(client, 'cancelQueries');
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');

    const read = await client.fetchQuery(groupDetailQueryOptions('a'));

    expect(read.name).toBe('Read');
    expect(groupDetailQueryOptions('a').staleTime).toBe(30_000);
    expect(otherEntries(client, 'a')).toEqual(before);
    expect(client.getQueryState(groupsKeys.activity('a'))).toBeUndefined();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
});

test.each([403, 404])(
    '#669 a detail %i is an ApiError, and the read leaves the list as it was',
    async status => {
        server.use(
            http.get('*/groups/a', () =>
                HttpResponse.json({ code: 'GROUP_NOT_FOUND' }, { status }),
            ),
        );
        const client = seededListClient([group('a'), group('b')], Date.now());
        const before = otherEntries(client, 'a');

        const error: unknown = await client
            .fetchQuery(groupDetailQueryOptions('a'))
            .catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(ApiError);
        expect(isGroupDeniedError(error)).toBe(true);
        expect(otherEntries(client, 'a')).toEqual(before);
    },
);

test('a failed detail refresh keeps the last confirmed group', async () => {
    server.use(http.get('*/groups/a', () => HttpResponse.json({}, { status: 500 })));
    const client = seededListClient([], 0);
    client.setQueryData(groupsKeys.detail('a'), testGroup('a', { name: 'Confirmed' }));

    await client.refetchQueries({ queryKey: groupsKeys.detail('a') });

    expect(client.getQueryData<Group>(groupsKeys.detail('a'))?.name).toBe('Confirmed');
});

test('ACT-023 a group activity continues from the cursor of its seeded first page', async () => {
    const cursors: (string | null)[] = [];
    server.use(
        http.get('*/groups/a/activity-previews', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'));
            return HttpResponse.json({ items: [wirePreview('p2')], nextCursor: null });
        }),
    );
    const client = new QueryClient();
    client.setQueryData(groupsKeys.activity('a'), {
        pages: [{ items: [preview('p1')], nextCursor: 7 }],
        pageParams: [null],
    });
    const observer = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));

    await observer.fetchNextPage();

    expect(cursors).toEqual(['7']);
    expect(
        flattenGroupActivity(
            client.getQueryData<GroupActivityData>(groupsKeys.activity('a')) ?? {
                pages: [],
                pageParams: [],
            },
        ),
    ).toEqual([preview('p1'), preview('p2')]);
});

test('a failed next activity page keeps the loaded pages and retries the same cursor', async () => {
    const cursors: (string | null)[] = [];
    let fail = true;
    server.use(
        http.get('*/groups/a/activity-previews', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'));
            return fail
                ? HttpResponse.json({}, { status: 500 })
                : HttpResponse.json({ items: [wirePreview('p2')], nextCursor: null });
        }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const firstPage = { pages: [{ items: [preview('p1')], nextCursor: 7 }], pageParams: [null] };
    client.setQueryData(groupsKeys.activity('a'), firstPage);
    const observer = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));

    await observer.fetchNextPage();
    expect(observer.getCurrentResult().isFetchNextPageError).toBe(true);
    expect(observer.getCurrentResult().data).toEqual(firstPage);

    fail = false;
    await observer.fetchNextPage();
    expect(cursors).toEqual(['7', '7']);
    expect(observer.getCurrentResult().data?.pages).toHaveLength(2);
});

test('ACT-021 ACT-022 group activity lists each parent once, its newest event in place', () => {
    const data: GroupActivityData = {
        pages: [
            { items: [preview('p1'), preview('p2')], nextCursor: 1 },
            // A later page repeats p1 with a newer event (an edit or a reversal tombstone) and
            // p2 with an older one.
            { items: [preview('p1', 3), preview('p2', 0), preview('p3')], nextCursor: null },
        ],
        pageParams: [null, 1],
    };

    expect(flattenGroupActivity(data)).toEqual([preview('p1', 3), preview('p2'), preview('p3')]);
});

test('a failed activity page is an ApiError, retried like the detail on a 5xx', async () => {
    server.use(
        http.get('*/groups/a/activity-previews', () => HttpResponse.json({}, { status: 503 })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const error: unknown = await client
        .fetchInfiniteQuery(groupActivityQueryOptions('a', client))
        .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError && error.status).toBe(503);
});

test('a group activity page is read through api() into Money; an unreadable preview is left out', async () => {
    const body = JSON.stringify({
        items: [wirePreview('p1'), wirePreview('bad'), wirePreview('p2')],
        nextCursor: null,
    }).replace(/("entryId":"entry-bad"[^}]*?"amount":)10/g, '$11e-7');
    server.use(
        http.get(
            '*/groups/a/activity-previews',
            () => new HttpResponse(body, { headers: { 'Content-Type': 'application/json' } }),
        ),
    );
    const client = new QueryClient();

    const data = await client.fetchInfiniteQuery(groupActivityQueryOptions('a', client));

    expect(data.pages[0]?.items).toEqual([
        preview('p1'),
        { kind: 'invalid', id: 'bad' },
        preview('p2'),
    ]);
    expect(flattenGroupActivity(data)).toEqual([preview('p1'), preview('p2')]);
});

const providerOf =
    (client: QueryClient) =>
    ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);

/** The group `a` detail and activity reads, counted; the detail answers `detail`, else `status`. */
const serveGroupA = (detail: ReturnType<typeof wireGroup> | number) => {
    const reads = { detail: 0, activity: 0 };

    server.use(
        http.get('*/groups/a/activity-previews', () => {
            reads.activity += 1;
            return HttpResponse.json({ items: [wirePreview('read')], nextCursor: null });
        }),
        http.get('*/groups/a', () => {
            reads.detail += 1;
            return typeof detail === 'number'
                ? HttpResponse.json({ code: 'GROUP_NOT_FOUND' }, { status: detail })
                : HttpResponse.json(detail);
        }),
    );
    return reads;
};

// A group page: its detail, and its activity enabled once the detail is loaded.
const useOpenedGroup = (groupId: string) => {
    const detail = useGroupDetailQuery(groupId, { enabled: true, placeholder: undefined });
    const activity = useGroupActivityQuery(groupId, { enabled: detail?.isSuccess === true });

    return { detail, activity };
};

test('#669 opening a group sends one request: the activity starts from the detail page, as old as the detail', async () => {
    const reads = serveGroupA(
        wireGroup('a', { recentActivities: { items: [wirePreview('p1')], nextCursor: 7 } }),
    );
    const client = createQueryClient();
    const view = renderHook(() => useOpenedGroup('a'), { wrapper: providerOf(client) });

    await waitFor(() => {
        expect(view.result.current.activity.isSuccess).toBe(true);
    });
    // Time for an activity request, were one sent.
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(reads).toEqual({ detail: 1, activity: 0 });
    expect(client.getQueryData(groupsKeys.activity('a'))).toEqual({
        pages: [{ items: [preview('p1')], nextCursor: 7 }],
        pageParams: [null],
    });
    expect(client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt).toBe(
        client.getQueryState(groupsKeys.detail('a'))?.dataUpdatedAt,
    );
    expect(view.result.current.activity.data?.items).toEqual([preview('p1')]);
    view.unmount();
});

test('#669 cached activity is never replaced by the detail page, and a denied detail seeds nothing', async () => {
    server.use(http.get('*/groups/b', () => HttpResponse.json({}, { status: 403 })));
    const cached = {
        pages: [{ items: [preview('cached')], nextCursor: null }],
        pageParams: [null],
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(groupsKeys.activity('a'), cached);
    client.setQueryData(
        groupsKeys.detail('a'),
        testGroup('a', { recentActivities: { items: [wirePreview('p1')], nextCursor: 7 } }),
    );
    // Group b: a detail cached from an earlier read, then denied.
    client.setQueryData(
        groupsKeys.detail('b'),
        testGroup('b', { recentActivities: { items: [wirePreview('p2')], nextCursor: null } }),
    );
    await client
        .fetchQuery({ ...groupDetailQueryOptions('b'), staleTime: 0 })
        .catch(() => undefined);
    expect(client.getQueryState(groupsKeys.detail('b'))?.status).toBe('error');

    const readerA = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));
    const readerB = new InfiniteQueryObserver(client, groupActivityQueryOptions('b', client));

    expect(readerA.getCurrentResult().data).toEqual(cached);
    expect(client.getQueryData(groupsKeys.activity('a'))).toEqual(cached);
    expect(readerB.getCurrentResult().data).toBeUndefined();
    expect(client.getQueryData(groupsKeys.activity('b'))).toBeUndefined();
});

test('#669 GRP-011 a denied group page reloads the list once: the server list no longer has the group', async () => {
    const reads = serveGroupA(403);
    let listReads = 0;
    server.use(
        http.get('*/groups', () => {
            listReads += 1;
            return HttpResponse.json({ items: [wireGroup('b')], nextCursor: null });
        }),
    );
    const client = createQueryClient();
    client.setQueryData(groupsKeys.list(), listData([group('a'), group('b')]));
    // The list a page shows: its reload is a request.
    const listReader = new InfiniteQueryObserver(client, groupsListQueryOptions());
    const stopList = listReader.subscribe(() => undefined);
    // Two readers of the denied group (the page and its header): one reload.
    const view = renderHook(
        () => [
            useGroupDetailQuery('a', { enabled: true, placeholder: undefined }),
            useGroupDetailQuery('a', { enabled: true, placeholder: undefined }),
        ],
        { wrapper: providerOf(client) },
    );

    await waitFor(() => {
        expect(listReads).toBe(1);
    });
    await waitFor(() => {
        expect(client.getQueryState(groupsKeys.list())?.fetchStatus).toBe('idle');
    });
    view.rerender();
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(reads.detail).toBe(1);
    expect(listReads).toBe(1);
    expect(
        flattenGroupsList(client.getQueryData<GroupsListData>(groupsKeys.list()) ?? listData()),
    ).toEqual([group('b')]);
    view.unmount();
    stopList();
});

/** List loads, counted, answered with group `a` read again. */
const serveListCounted = (): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/groups', () => {
            counter.count += 1;
            return HttpResponse.json({
                items: [wireGroup('a', { name: 'Listed again' })],
                nextCursor: null,
            });
        }),
    );
    return counter;
};

const useGroupPageDetail = () =>
    useGroupDetailQuery('a', { enabled: true, placeholder: undefined });

test('#669 a detail read newer than the list marks it stale without a request; the next list mount reads it', async () => {
    serveGroupA(wireGroup('a', { name: 'Read' }));
    const listReads = serveListCounted();
    const client = createQueryClient();
    client.setQueryData(groupsKeys.list(), listData([group('a')]), {
        updatedAt: Date.now() - 1_000,
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const view = renderHook(useGroupPageDetail, { wrapper: providerOf(client) });

    await waitFor(() => {
        expect(client.getQueryState(groupsKeys.list())?.isInvalidated).toBe(true);
    });
    view.rerender();
    await new Promise(resolve => setTimeout(resolve, 20));
    // Once per read, however many renders.
    expect(invalidate).toHaveBeenCalledOnce();
    expect(listReads.count).toBe(0);
    expect(
        flattenGroupsList(client.getQueryData<GroupsListData>(groupsKeys.list()) ?? listData()),
    ).toEqual([group('a')]);

    // Back on the list page: its reader mounts and reads it again.
    const listReader = new InfiniteQueryObserver(client, groupsListQueryOptions());
    const stopList = listReader.subscribe(() => undefined);

    await waitFor(() => {
        expect(listReads.count).toBe(1);
    });
    stopList();
    view.unmount();
});

test('#669 a detail older than the list leaves the list fresh', async () => {
    // Both read in this page (an entry restored from before the page load is read again, #724).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PAGE_LOADED_AT + 60_000);
    onTestFinished(() => {
        vi.useRealTimers();
    });
    const reads = serveGroupA(wireGroup('a'));
    const listReads = serveListCounted();
    const client = createQueryClient();
    client.setQueryData(groupsKeys.detail('a'), group('a'), { updatedAt: Date.now() - 2_000 });
    client.setQueryData(groupsKeys.list(), listData([group('a')]), {
        updatedAt: Date.now() - 1_000,
    });
    const view = renderHook(useGroupPageDetail, { wrapper: providerOf(client) });

    await waitFor(() => {
        expect(view.result.current?.isSuccess).toBe(true);
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(reads.detail).toBe(0);
    expect(client.getQueryState(groupsKeys.list())?.isInvalidated).toBe(false);
    expect(listReads.count).toBe(0);
    view.unmount();
});

test('#669 a failed first activity load keeps its error: the detail page does not replace it', async () => {
    server.use(
        http.get('*/groups/a/activity-previews', () => HttpResponse.json({}, { status: 500 })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await client.fetchInfiniteQuery(groupActivityQueryOptions('a', client)).catch(() => undefined);
    client.setQueryData(
        groupsKeys.detail('a'),
        testGroup('a', { recentActivities: { items: [wirePreview('p1')], nextCursor: 7 } }),
    );
    const reader = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));

    expect(reader.getCurrentResult().data).toBeUndefined();
    expect(client.getQueryState(groupsKeys.activity('a'))?.status).toBe('error');
});

test('#669 a running first activity load answers over the seed the detail page gave meanwhile', async () => {
    let answer: (() => void) | undefined;
    server.use(
        http.get(
            '*/groups/a/activity-previews',
            () =>
                new Promise<Response>(resolve => {
                    answer = () => {
                        resolve(
                            HttpResponse.json({ items: [wirePreview('read')], nextCursor: null }),
                        );
                    };
                }),
        ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const loading = client.fetchInfiniteQuery(groupActivityQueryOptions('a', client));

    await vi.waitFor(() => {
        expect(answer).toBeDefined();
    });
    client.setQueryData(
        groupsKeys.detail('a'),
        testGroup('a', { recentActivities: { items: [wirePreview('seed')], nextCursor: 7 } }),
    );
    const reader = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));

    // The seed shows while the load runs (TanStack applies it to an entry without data).
    expect(reader.getCurrentResult().data?.pages).toEqual([
        { items: [preview('seed')], nextCursor: 7 },
    ]);
    answer?.();
    await loading;

    expect(client.getQueryData(groupsKeys.activity('a'))).toEqual({
        pages: [{ items: [preview('read')], nextCursor: null }],
        pageParams: [null],
    });
});

test('the list and the detail are read through api() into domain groups', async () => {
    const wire = wireGroup('a', {
        members: [
            {
                user: wireGroup('a').creator,
                balancesByCurrency: { USD: { currency: 'USD', netBalance: -12.3456 } },
            },
        ],
        recentActivities: { items: [wirePreview('p1')], nextCursor: 7 },
    });
    server.use(
        http.get('*/groups', () => HttpResponse.json({ items: [wire], nextCursor: null })),
        http.get('*/groups/a', () => HttpResponse.json(wire)),
    );
    const client = new QueryClient();

    const list = await client.fetchInfiniteQuery(groupsListQueryOptions());
    const detail = await client.fetchQuery(groupDetailQueryOptions('a'));

    expect(list.pages[0]?.items).toEqual([testGroup('a', wire)]);
    expect(detail).toEqual(testGroup('a', wire));
    expect(detail.members[0]?.balancesByCurrency.USD?.net.minor).toBe(-123_456n);
});

test('a detail with an unreadable preview carries it as an invalid item, left out when read', async () => {
    const body = JSON.stringify(
        wireGroup('a', {
            recentActivities: { items: [wirePreview('p1'), wirePreview('bad')], nextCursor: null },
        }),
    ).replace(/("entryId":"entry-bad"[^}]*?"amount":)10/g, '$11e-7');
    server.use(
        http.get(
            '*/groups/a',
            () => new HttpResponse(body, { headers: { 'Content-Type': 'application/json' } }),
        ),
    );
    const client = new QueryClient();

    const detail = await client.fetchQuery(groupDetailQueryOptions('a'));
    // The activity a group page then reads starts from that page.
    new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));

    expect(detail.recentActivities.items).toEqual([preview('p1'), { kind: 'invalid', id: 'bad' }]);
    expect(
        flattenGroupActivity(
            client.getQueryData<GroupActivityData>(groupsKeys.activity('a')) ?? {
                pages: [],
                pageParams: [],
            },
        ),
    ).toEqual([preview('p1')]);
});

const groupOwing = (net: number) =>
    wireGroup('a', {
        members: [
            {
                user: wireGroup('a').creator,
                balancesByCurrency: { USD: { currency: 'USD', netBalance: net } },
            },
        ],
    });

const usdNet = (detail: Group | undefined): bigint | undefined =>
    detail?.members[0]?.balancesByCurrency.USD?.net.minor;

test('#724 a detail restored from a snapshot taken before a payment is read again on mount, showing the restored balance meanwhile', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let served = groupOwing(-50);

    server.use(http.get('*/groups/a', () => HttpResponse.json(served)));
    try {
        // Before the reload: the detail is read and the cache saved, then a payment is recorded
        // and the throttled save never runs.
        vi.setSystemTime(PAGE_LOADED_AT - 800);
        const before = createQueryClient();

        await before.fetchQuery(groupDetailQueryOptions('a'));
        const snapshot = dehydrate(before, dehydrateOptions);

        served = groupOwing(-20);

        // The reload, within the detail's stale time of the snapshot.
        vi.setSystemTime(PAGE_LOADED_AT + 200);
        const after = createQueryClient();

        hydrate(after, snapshot);
        const observer = new QueryObserver(after, groupDetailQueryOptions('a'));
        const unsubscribe = observer.subscribe(() => undefined);

        try {
            expect(usdNet(observer.getCurrentResult().data)).toBe(-500_000n);
            expect(observer.getCurrentResult().isFetching).toBe(true);
            await vi.waitFor(() => {
                expect(usdNet(observer.getCurrentResult().data)).toBe(-200_000n);
            });
        } finally {
            unsubscribe();
        }
    } finally {
        vi.useRealTimers();
    }
});

test('#724 a detail read in this page stays fresh for its stale time: a mount reads nothing', async () => {
    let reads = 0;

    server.use(
        http.get('*/groups/a', () => {
            reads += 1;
            return HttpResponse.json(groupOwing(-50));
        }),
    );
    const client = createQueryClient();

    await client.fetchQuery(groupDetailQueryOptions('a'));
    const observer = new QueryObserver(client, groupDetailQueryOptions('a'));
    const unsubscribe = observer.subscribe(() => undefined);

    expect(observer.getCurrentResult().isFetching).toBe(false);
    unsubscribe();
    expect(reads).toBe(1);
});

test('#724 the list balances and the group activity restored from before the reload are read again on mount', () => {
    expect(groupsListQueryOptions().refetchOnMount).toBe(refetchIfRestored);
    expect(groupActivityQueryOptions('a', new QueryClient()).refetchOnMount).toBe(
        refetchIfRestored,
    );
});

/** Activity pages by cursor: none → cursor 1 → cursor 2 → the end, counted. */
const serveThreeActivityPages = (): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/groups/a/activity-previews', ({ request }) => {
            counter.count += 1;
            const cursor = Number(new URL(request.url).searchParams.get('cursor') ?? 0);

            return HttpResponse.json({
                items: [wirePreview(`p${String(cursor)}`)],
                nextCursor: cursor < 2 ? cursor + 1 : null,
            });
        }),
    );
    return counter;
};

const activityPageCount = (client: QueryClient): number | undefined =>
    client.getQueryData<GroupActivityData>(groupsKeys.activity('a'))?.pages.length;

// The trim runs a microtask after the cleanup of the group page's activity.
const afterCleanup = (): Promise<void> => Promise.resolve();

// A group page's activity on `client`, three pages of group `a` loaded.
const mountThreeActivityPages = async (client: QueryClient) => {
    const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);
    const view = renderHook(
        ({ groupId }: { groupId: string }) => useGroupActivityQuery(groupId, { enabled: true }),
        { wrapper, initialProps: { groupId: 'a' } },
    );

    await waitFor(() => {
        expect(view.result.current.isSuccess).toBe(true);
    });
    await act(() => view.result.current.fetchNextPage());
    await act(() => view.result.current.fetchNextPage());
    expect(activityPageCount(client)).toBe(3);
    return view;
};

// As `mountThreeActivityPages`; returns its unmount.
const readThreeActivityPages = async (client: QueryClient): Promise<() => void> =>
    (await mountThreeActivityPages(client)).unmount;

test('a mount refetch of a stale multi-page group activity loads one page', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        const requests = serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);
        const loadedAt = client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt;

        unmount();
        await afterCleanup();
        // Cut when the last reader left, keeping its age.
        expect(activityPageCount(client)).toBe(1);
        expect(client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt).toBe(loadedAt);

        vi.setSystemTime(PAGE_LOADED_AT + 120_000);
        const remount = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));
        const unsubscribe = remount.subscribe(() => undefined);

        expect(remount.getCurrentResult().isFetching).toBe(true);
        await vi.waitFor(() => {
            expect(remount.getCurrentResult().isFetching).toBe(false);
        });
        unsubscribe();
        expect(requests.count).toBe(4);
    } finally {
        vi.useRealTimers();
    }
});

test('a group activity left offline keeps its loaded pages', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);

        onlineManager.setOnline(false);
        unmount();
        await afterCleanup();

        expect(activityPageCount(client)).toBe(3);
    } finally {
        onlineManager.setOnline(true);
        vi.useRealTimers();
    }
});

test('#881 a group activity left offline is cut to its first page once the network is back, keeping its age', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);
        const loadedAt = client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt;

        onlineManager.setOnline(false);
        unmount();
        await afterCleanup();
        expect(activityPageCount(client)).toBe(3);

        onlineManager.setOnline(true);
        await vi.waitFor(() => {
            expect(activityPageCount(client)).toBe(1);
        });
        expect(client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt).toBe(loadedAt);
        client.clear();
    } finally {
        onlineManager.setOnline(true);
        vi.useRealTimers();
    }
});

test('#881 a group activity left offline and shown again before the network is back keeps its pages', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);

        onlineManager.setOnline(false);
        unmount();
        await afterCleanup();
        const shown = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));
        const unsubscribe = shown.subscribe(() => undefined);

        onlineManager.setOnline(true);
        // The waiter runs in a microtask after the online notification.
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(activityPageCount(client)).toBe(3);
        unsubscribe();
        client.clear();
    } finally {
        onlineManager.setOnline(true);
        vi.useRealTimers();
    }
});

test('#881 a group activity left offline on a client cleared before the network is back: the cut finds nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);

        onlineManager.setOnline(false);
        unmount();
        await afterCleanup();
        // A sign-out meanwhile: the cache is emptied while the cut waits for the network.
        client.clear();

        onlineManager.setOnline(true);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(client.getQueryCache().getAll()).toEqual([]);
    } finally {
        onlineManager.setOnline(true);
        vi.useRealTimers();
    }
});

test('a group activity left while another reader still shows it keeps its pages', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);
        const other = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));
        const unsubscribe = other.subscribe(() => undefined);

        unmount();
        await afterCleanup();

        expect(activityPageCount(client)).toBe(3);
        unsubscribe();
    } finally {
        vi.useRealTimers();
    }
});

test('a next page loading when the group activity is left is cancelled, and the feed is cut', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        const client = createQueryClient();
        const unmount = await readThreeActivityPages(client);
        // The last page has no next cursor: load the first two again, then one more.
        client.setQueryData<GroupActivityData>(
            groupsKeys.activity('a'),
            data =>
                data && { pages: data.pages.slice(0, 2), pageParams: data.pageParams.slice(0, 2) },
        );
        const observer = new InfiniteQueryObserver(client, groupActivityQueryOptions('a', client));
        const unsubscribe = observer.subscribe(() => undefined);
        const nextPage = observer.fetchNextPage();

        expect(client.getQueryState(groupsKeys.activity('a'))?.fetchStatus).toBe('fetching');
        // TanStack cancels the load of the last reader (its signal is read) and restores the
        // pages from before it, so the cut sees an idle feed.
        unsubscribe();
        unmount();
        await afterCleanup();
        await nextPage;

        expect(client.getQueryState(groupsKeys.activity('a'))?.fetchStatus).toBe('idle');
        expect(activityPageCount(client)).toBe(1);
    } finally {
        vi.useRealTimers();
    }
});

test('a group page moving to another group cuts the activity it left', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(PAGE_LOADED_AT + 60_000);
        serveThreeActivityPages();
        server.use(
            http.get('*/groups/b/activity-previews', () =>
                HttpResponse.json({ items: [wirePreview('b1')], nextCursor: null }),
            ),
        );
        const client = createQueryClient();
        const { rerender, unmount } = await mountThreeActivityPages(client);

        // The page stays mounted: a group card link opens group `b`.
        rerender({ groupId: 'b' });
        await afterCleanup();

        expect(activityPageCount(client)).toBe(1);
        unmount();
    } finally {
        vi.useRealTimers();
    }
});
