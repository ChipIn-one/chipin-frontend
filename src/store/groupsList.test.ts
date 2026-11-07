import { InfiniteQueryObserver } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';
import { groupsKeys, groupsListQueryOptions } from 'entities/groups';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import {
    dropGroupFromList,
    getCachedGroups,
    invalidateGroupsList,
    loadGroupsListForSession,
    putGroupInList,
    reloadGroupsListWith,
} from './groupsList';

const server = setupMswServer();

const group = (id: string, name = `Group ${id}`) => ({ id, name }) as unknown as Group;

/** Answers the list loads in turn (the last answer repeats), counting them. */
const serveGroups = (...answers: { groups: Group[]; wait?: number }[]): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/groups', async () => {
            const answer = answers[Math.min(counter.count, answers.length - 1)];

            counter.count += 1;
            if (answer?.wait) {
                await delay(answer.wait);
            }
            return HttpResponse.json({ items: answer?.groups ?? [], nextCursor: null });
        }),
    );
    return counter;
};

let userCache: UserDashboardCache;
let stopWatching: (() => void) | undefined;

const listKey = groupsKeys.list();
const listed = () => cachedGroupsList(userCache.client);
const seed = (groups: Group[], updatedAt = Date.now()) => {
    userCache.client.setQueryData(listKey, groupsListData(groups), { updatedAt });
};
// A mounted reader: the list is active, so invalidating it reloads it.
const watchList = (): void => {
    const observer = new InfiniteQueryObserver(userCache.client, groupsListQueryOptions());

    stopWatching = observer.subscribe(() => undefined);
};
const startListLoad = () => userCache.client.refetchQueries({ queryKey: listKey });
const settled = () =>
    new Promise<void>(resolve => {
        const check = () => {
            if (userCache.client.isFetching({ queryKey: listKey }) === 0) {
                resolve();
            } else {
                setTimeout(check, 5);
            }
        };
        check();
    });

beforeEach(() => {
    userCache = mountUserDashboardCache();
});

afterEach(() => {
    stopWatching?.();
    stopWatching = undefined;
    userCache.dispose();
});

test('a session start without the user client sends no request', async () => {
    const requests = serveGroups({ groups: [group('a')] });
    userCache.dispose();

    await loadGroupsListForSession(Date.now() - 1_000);

    expect(requests.count).toBe(0);
});

test('a session start reuses a list loaded after it began and reloads an older one', async () => {
    const requests = serveGroups({ groups: [group('fresh')] });
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
    const requests = serveGroups({ groups: [group('a')], wait: 20 });
    seed([], 0);
    // The reader mounts on a stale list: its load is running.
    watchList();

    await loadGroupsListForSession(Date.now());
    await settled();

    expect(requests.count).toBe(1);
    expect(listed()).toEqual([group('a')]);
});

test('a change cancels a running list load and reloads: the older answer is never applied', async () => {
    const requests = serveGroups({ groups: [group('old')], wait: 30 }, { groups: [group('new')] });
    seed([]);
    watchList();
    void startListLoad();

    await invalidateGroupsList();
    await delay(40);

    expect(requests.count).toBe(2);
    expect(listed()).toEqual([group('new')]);
});

test('a group read by a legacy action replaces its list entry without a request, keeping the age', async () => {
    const requests = serveGroups({ groups: [] });
    const updatedAt = Date.now() - 10_000;
    seed([group('a'), group('b')], updatedAt);
    watchList();

    await putGroupInList(group('a', 'Renamed'));

    expect(requests.count).toBe(0);
    expect(listed()).toEqual([group('a', 'Renamed'), group('b')]);
    expect(userCache.client.getQueryState(listKey)?.dataUpdatedAt).toBe(updatedAt);
});

test('a group written during a list load cancels that load and loads the list again', async () => {
    const requests = serveGroups(
        { groups: [group('a', 'Before the write')], wait: 30 },
        { groups: [group('a', 'Server copy'), group('b')] },
    );
    seed([group('a')]);
    watchList();
    void startListLoad();

    await putGroupInList(group('a', 'Written'));
    await settled();
    await delay(40);

    expect(requests.count).toBe(2);
    expect(listed()).toEqual([group('a', 'Server copy'), group('b')]);
});

test('a group the user can no longer read leaves the list without a request', async () => {
    const requests = serveGroups({ groups: [] });
    seed([group('a'), group('b')]);
    watchList();

    await dropGroupFromList('a');

    expect(requests.count).toBe(0);
    expect(listed()).toEqual([group('b')]);
});

test('an edit of a list never loaded writes nothing', async () => {
    await putGroupInList(group('a'));

    expect(listed()).toBeUndefined();
    expect(getCachedGroups()).toBeUndefined();
});

test('a legacy group write shows at once, reloads the list and stays in it', async () => {
    const requests = serveGroups({ groups: [group('a', 'Server copy'), group('b')] });
    seed([group('a')]);
    watchList();

    const reload = reloadGroupsListWith(group('a', 'Written'), () => true);

    expect(listed()).toEqual([group('a', 'Written')]);
    await reload;
    expect(requests.count).toBe(1);
    expect(listed()).toEqual([group('a', 'Written'), group('b')]);
});

test('a legacy group write that is no longer current keeps what the reload read', async () => {
    serveGroups({ groups: [group('b')] });
    seed([]);
    watchList();

    await reloadGroupsListWith(group('a'), () => false);

    expect(listed()).toEqual([group('b')]);
});

test("the legacy actions read the tab user's cached groups", () => {
    seed([group('a'), group('b')]);

    expect(getCachedGroups()).toEqual([group('a'), group('b')]);
});
