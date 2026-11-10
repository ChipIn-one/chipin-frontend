import { InfiniteQueryObserver, onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group as LegacyGroup } from 'api/chipin.types';
import { type Group, groupsKeys, groupsListQueryOptions } from 'entities/groups';
import { testGroup, wireGroup } from 'test/groupFixtures';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { getCachedGroups, invalidateGroup, loadGroupsListForSession } from './groupsList';

const server = setupMswServer();

// The domain group the queries cache, and the same group as the wire (and a legacy write) gives it.
const group = (id: string, name = `Group ${id}`): Group => testGroup(id, { name });
const wire = (id: string, name = `Group ${id}`): LegacyGroup => wireGroup(id, { name });

interface ListServer {
    /** Requests received so far. */
    count: number;
    /** Answers the `index`-th request (0-based) with `groups`. */
    answer: (index: number, groups: LegacyGroup[]) => void;
}

/** List loads that wait until the test answers them, in order of arrival. */
const serveGroupsByHand = (): ListServer => {
    const answers: ((groups: LegacyGroup[]) => void)[] = [];
    const listServer: ListServer = {
        count: 0,
        answer: (index, groups) => {
            answers[index]?.(groups);
        },
    };

    server.use(
        http.get('*/groups', () => {
            listServer.count += 1;
            return new Promise<Response>(resolve => {
                answers.push(groups =>
                    resolve(HttpResponse.json({ items: groups, nextCursor: null })),
                );
            });
        }),
    );
    return listServer;
};

/** List loads answered at once with `groups`, counted. */
const serveGroups = (groups: LegacyGroup[]): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/groups', () => {
            counter.count += 1;
            return HttpResponse.json({ items: groups, nextCursor: null });
        }),
    );
    return counter;
};

let userCache: UserDashboardCache;
let stopWatching: (() => void) | undefined;

const listKey = groupsKeys.list();
const listed = () => cachedGroupsList(userCache.client);
const listState = () => userCache.client.getQueryState(listKey);
const seed = (groups: Group[], updatedAt = Date.now()) => {
    userCache.client.setQueryData(listKey, groupsListData(groups), { updatedAt });
};
// A mounted reader: the list is active, so invalidating it reloads it.
const watchList = (options: { refetchOnReconnect?: boolean } = {}): void => {
    const observer = new InfiniteQueryObserver(userCache.client, {
        ...groupsListQueryOptions(),
        ...options,
    });

    stopWatching = observer.subscribe(() => undefined);
};
const listSettled = () =>
    vi.waitFor(() => {
        expect(listState()?.fetchStatus).toBe('idle');
    });
const requestsReach = (listServer: { count: number }, count: number) =>
    vi.waitFor(() => {
        expect(listServer.count).toBe(count);
    });

beforeEach(() => {
    userCache = mountUserDashboardCache();
});

afterEach(() => {
    stopWatching?.();
    stopWatching = undefined;
    userCache.dispose();
    onlineManager.setOnline(true);
});

test('a session start without the user client sends no request', async () => {
    const requests = serveGroups([wire('a')]);
    userCache.dispose();

    await loadGroupsListForSession(Date.now() - 1_000);

    expect(requests.count).toBe(0);
});

test('a session start reuses a list loaded after it began and reloads an older one', async () => {
    const requests = serveGroups([wire('fresh')]);
    const since = Date.now();
    watchList();
    seed([group('a')], since + 1);

    await loadGroupsListForSession(since);
    expect(requests.count).toBe(0);

    seed([group('a')], since - 1);
    await loadGroupsListForSession(since);
    expect(requests.count).toBe(1);
    expect(listed()).toEqual([group('fresh')]);
});

test('a session start joins a list load already running: one request', async () => {
    const listServer = serveGroupsByHand();
    seed([], 0);
    // The reader mounts on a stale list: its load is running.
    watchList();
    await requestsReach(listServer, 1);

    const sessionLoad = loadGroupsListForSession(Date.now());
    listServer.answer(0, [wire('a')]);
    await sessionLoad;
    await listSettled();

    expect(listServer.count).toBe(1);
    expect(listed()).toEqual([group('a')]);
});

test("the legacy actions read the tab user's cached groups", () => {
    seed([group('a'), group('b')]);

    expect(getCachedGroups()).toEqual([group('a'), group('b')]);
});

const activityKey = groupsKeys.activity('a');
const detailKey = groupsKeys.detail('a');
const activityPage = (parentId: string, nextCursor: number | null) => ({
    items: [{ parent: { id: parentId }, lastEvent: { id: `e-${parentId}`, seq: 1 } }],
    nextCursor,
});
const seedActivity = (pages: number) => {
    userCache.client.setQueryData(
        activityKey,
        {
            pages: Array.from({ length: pages }, (_item, index) =>
                activityPage(`p${String(index)}`, index + 1),
            ),
            pageParams: Array.from({ length: pages }, (_item, index) =>
                index === 0 ? null : index,
            ),
        },
        { updatedAt: Date.now() - 1_000 },
    );
};

test('a changed group is read again on any page: no group page needed, its list entry updates', async () => {
    let detailReads = 0;
    server.use(
        http.get('*/groups/a', () => {
            detailReads += 1;
            return HttpResponse.json(wire('a', 'New balances'));
        }),
    );
    seed([group('a'), group('b')], Date.now() - 1_000);
    seedActivity(2);

    // No observer of the detail (the dashboard, the friends page).
    await invalidateGroup('a');

    expect(detailReads).toBe(1);
    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a', 'New balances'));
    expect(listed()).toEqual([group('a', 'New balances'), group('b')]);
    expect(userCache.client.getQueryState(activityKey)?.isInvalidated).toBe(true);
    expect(userCache.client.getQueryData<{ pages: unknown[] }>(activityKey)?.pages).toHaveLength(1);
});

test('a failed read after a change keeps the list and never rejects', async () => {
    server.use(http.get('*/groups/a', () => HttpResponse.json({}, { status: 500 })));
    seed([group('a')], Date.now() - 1_000);

    await expect(invalidateGroup('a')).resolves.toBeUndefined();
    expect(listed()).toEqual([group('a')]);
});
