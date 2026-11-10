import { dehydrate, InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { ApiError } from 'shared/api/client';
import { dehydrateOptions, trimInfinitePages } from 'shared/offline/queryPersister';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { testGroup, wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';

import { flattenGroupActivity, type GroupActivityData } from '../model/groupActivity';
import {
    flattenGroupsList,
    type GroupsListData,
    removeGroupFromList,
    upsertGroupInList,
} from '../model/groupsList';
import type { Group } from '../model/types';

import {
    groupActivityQueryOptions,
    groupDetailQueryOptions,
    groupsKeys,
    groupsListQueryOptions,
    isGroupDeniedError,
    seedGroupActivity,
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

test('drops a group from every page', () => {
    const data = listData([group('a'), group('b')], [group('a')]);

    expect(removeGroupFromList(data, 'a').pages.map(page => page.items)).toEqual([
        [group('b')],
        [],
    ]);
});

const detailGroup = (id: string, name: string) =>
    wireGroup(id, { name, recentActivities: { items: [], nextCursor: 7 } });

const preview = (parentId: string, seq = 1) => domainPreview(parentId, { seq });

const seededListClient = (groups: Group[], updatedAt: number): QueryClient => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(groupsKeys.list(), listData(groups), { updatedAt });
    return client;
};

test('a group detail read replaces its list entry', async () => {
    server.use(http.get('*/groups/a', () => HttpResponse.json(detailGroup('a', 'Read'))));
    const client = seededListClient([group('a'), group('b')], Date.now() - 1_000);

    const read = await client.fetchQuery(groupDetailQueryOptions('a'));

    expect(read.name).toBe('Read');
    expect(groupDetailQueryOptions('a').staleTime).toBe(30_000);
    expect(
        flattenGroupsList(client.getQueryData<GroupsListData>(groupsKeys.list()) ?? listData()),
    ).toEqual([read, group('b')]);
});

test('a seed becomes the first activity page, as old as the detail read that carried it', () => {
    const client = new QueryClient();
    const page = { items: [preview('p1')], nextCursor: 7 };

    seedGroupActivity(client, 'a', page, 1_000);
    expect(client.getQueryData(groupsKeys.activity('a'))).toEqual({
        pages: [page],
        pageParams: [null],
    });
    expect(client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt).toBe(1_000);

    // Cached activity (a newer read) is never replaced.
    seedGroupActivity(client, 'a', { items: [preview('p2')], nextCursor: null }, Date.now());
    expect(client.getQueryData(groupsKeys.activity('a'))).toEqual({
        pages: [page],
        pageParams: [null],
    });
});

test('a seed does nothing while the first activity page is loading', async () => {
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
    const client = new QueryClient();
    const loading = client.fetchInfiniteQuery(groupActivityQueryOptions('a'));

    expect(client.getQueryState(groupsKeys.activity('a'))?.fetchStatus).toBe('fetching');
    seedGroupActivity(client, 'a', { items: [preview('seed')], nextCursor: 7 }, Date.now());
    expect(client.getQueryData(groupsKeys.activity('a'))).toBeUndefined();

    await vi.waitFor(() => {
        expect(answer).toBeDefined();
    });
    answer?.();
    await loading;
    expect(
        flattenGroupActivity(
            client.getQueryData<GroupActivityData>(groupsKeys.activity('a')) ?? {
                pages: [],
                pageParams: [],
            },
        ),
    ).toEqual([preview('read')]);
});

test.each([403, 404])(
    'a detail %i is an ApiError and drops the group from the list',
    async status => {
        server.use(
            http.get('*/groups/a', () =>
                HttpResponse.json({ code: 'GROUP_NOT_FOUND' }, { status }),
            ),
        );
        const client = seededListClient([group('a'), group('b')], Date.now());

        const error: unknown = await client
            .fetchQuery(groupDetailQueryOptions('a'))
            .catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(ApiError);
        expect(isGroupDeniedError(error)).toBe(true);
        expect(
            flattenGroupsList(client.getQueryData<GroupsListData>(groupsKeys.list()) ?? listData()),
        ).toEqual([group('b')]);
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
    const observer = new InfiniteQueryObserver(client, groupActivityQueryOptions('a'));

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
    const observer = new InfiniteQueryObserver(client, groupActivityQueryOptions('a'));

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
        .fetchInfiniteQuery(groupActivityQueryOptions('a'))
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

    const data = await client.fetchInfiniteQuery(groupActivityQueryOptions('a'));

    expect(data.pages[0]?.items).toEqual([
        preview('p1'),
        { kind: 'invalid', id: 'bad' },
        preview('p2'),
    ]);
    expect(flattenGroupActivity(data)).toEqual([preview('p1'), preview('p2')]);
});

test('a group detail read seeds the empty activity with the page it carries, as old as the read', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 50_000 });
    try {
        server.use(
            http.get('*/groups/a', () =>
                HttpResponse.json(
                    wireGroup('a', {
                        recentActivities: { items: [wirePreview('p1')], nextCursor: 7 },
                    }),
                ),
            ),
        );
        const client = new QueryClient();

        await client.fetchQuery(groupDetailQueryOptions('a'));

        expect(client.getQueryData(groupsKeys.activity('a'))).toEqual({
            pages: [{ items: [preview('p1')], nextCursor: 7 }],
            pageParams: [null],
        });
        expect(client.getQueryState(groupsKeys.activity('a'))?.dataUpdatedAt).toBe(50_000);
    } finally {
        vi.useRealTimers();
    }
});

test('a group detail read never replaces cached activity, and a denied read seeds nothing', async () => {
    const cached = {
        pages: [{ items: [preview('cached')], nextCursor: null }],
        pageParams: [null],
    };
    server.use(
        http.get('*/groups/a', () =>
            HttpResponse.json(
                wireGroup('a', { recentActivities: { items: [wirePreview('p1')], nextCursor: 7 } }),
            ),
        ),
        http.get('*/groups/b', () => HttpResponse.json({}, { status: 403 })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(groupsKeys.activity('a'), cached);

    await client.fetchQuery(groupDetailQueryOptions('a'));
    await client.fetchQuery(groupDetailQueryOptions('b')).catch(() => undefined);

    expect(client.getQueryData(groupsKeys.activity('a'))).toEqual(cached);
    expect(client.getQueryData(groupsKeys.activity('b'))).toBeUndefined();
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
