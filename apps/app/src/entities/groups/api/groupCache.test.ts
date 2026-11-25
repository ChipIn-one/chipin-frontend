import {
    focusManager,
    InfiniteQueryObserver,
    onlineManager,
    QueryObserver,
} from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group as LegacyGroup } from 'api/chipin.types';
import { PAGE_LOADED_AT } from 'shared/api/queryClient';
import { testGroup, wireGroup } from 'test/groupFixtures';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import type { Group } from '../model/types';

import {
    forgetGroup,
    keepRejoinedGroup,
    putGroupAndReloadList,
    reloadGroupsList,
    writeGroupDetail,
} from './groupCache';
import { dropGroupFromCachedList, putGroupInCachedList } from './listCache';
import {
    groupActivityQueryOptions,
    groupDetailQueryOptions,
    groupsKeys,
    groupsListQueryOptions,
} from './queries';

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
// A list seeded seconds ago must have been read in this page: one older than the page load was
// restored from the persisted cache, and a mount reads it again (#724).
const runAMinuteAfterPageLoad = (): void => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PAGE_LOADED_AT + 60_000);
};
const startListLoad = () => userCache.client.refetchQueries({ queryKey: listKey });
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
    focusManager.setFocused(undefined);
    vi.useRealTimers();
});

test('a change cancels a running list load and reloads: the older answer is never applied', async () => {
    const listServer = serveGroupsByHand();
    seed([]);
    watchList();
    void startListLoad();
    await requestsReach(listServer, 1);

    const invalidation = reloadGroupsList(userCache.client);
    await requestsReach(listServer, 2);
    listServer.answer(0, [wire('old')]);
    listServer.answer(1, [wire('new')]);
    await invalidation;
    await listSettled();

    expect(listed()).toEqual([group('new')]);
});

test('a group read replaces its list entry without a request, keeping the age', async () => {
    runAMinuteAfterPageLoad();
    const requests = serveGroups([]);
    const updatedAt = Date.now() - 10_000;
    seed([group('a'), group('b')], updatedAt);
    watchList();

    await putGroupInCachedList(userCache.client, group('a', 'Renamed'), updatedAt + 1);

    expect(requests.count).toBe(0);
    expect(listed()).toEqual([group('a', 'Renamed'), group('b')]);
    expect(listState()?.dataUpdatedAt).toBe(updatedAt);
});

test('a group read sent before the last list load loads the list again instead of writing', async () => {
    const requests = serveGroups([wire('a', 'Server copy'), wire('b')]);
    const readStartedAt = Date.now() - 5_000;
    seed([group('a', 'From the list'), group('b')]);
    watchList();

    await putGroupInCachedList(userCache.client, group('a', 'Detail answer'), readStartedAt);

    // Neither copy is trusted: the server decides with one more list load.
    expect(requests.count).toBe(1);
    expect(listed()).toEqual([group('a', 'Server copy'), group('b')]);
});

test('a denied group leaves the list even when the list loaded after the read was sent', async () => {
    const requests = serveGroups([]);
    seed([group('a'), group('b')]);
    watchList();

    await dropGroupFromCachedList(userCache.client, 'a');

    expect(requests.count).toBe(0);
    expect(listed()).toEqual([group('b')]);
});

test('a group written during a list load cancels that load and loads the list again', async () => {
    const listServer = serveGroupsByHand();
    seed([group('a')]);
    watchList();
    void startListLoad();
    await requestsReach(listServer, 1);

    // It settles once the restarted load has its answer.
    const put = putGroupInCachedList(userCache.client, group('a', 'Written'));
    expect(listed()).toEqual([group('a', 'Written')]);
    await requestsReach(listServer, 2);
    listServer.answer(0, [wire('a', 'Before the write')]);
    listServer.answer(1, [wire('a', 'Server copy'), wire('b')]);
    await put;
    await listSettled();

    expect(listed()).toEqual([group('a', 'Server copy'), group('b')]);
});

test('a group written while a list load waits offline puts the load back in line', async () => {
    const requests = serveGroups([wire('a', 'Server copy')]);
    seed([group('a')]);
    // No reconnect refetch: only the restarted load can reach the server.
    watchList({ refetchOnReconnect: false });
    // Network events reach the cache of a mounted client only.
    userCache.client.mount();
    onlineManager.setOnline(false);
    void startListLoad();
    expect(listState()?.fetchStatus).toBe('paused');

    const put = putGroupInCachedList(userCache.client, group('a', 'Written'));

    expect(listed()).toEqual([group('a', 'Written')]);
    expect(listState()?.fetchStatus).toBe('paused');
    onlineManager.setOnline(true);
    await put;
    await listSettled();
    userCache.client.unmount();
    expect(requests.count).toBe(1);
    expect(listed()).toEqual([group('a', 'Server copy')]);
});

test('a group the user can no longer read leaves the list without a request', async () => {
    runAMinuteAfterPageLoad();
    const requests = serveGroups([]);
    seed([group('a'), group('b')], Date.now() - 1_000);
    watchList();

    await dropGroupFromCachedList(userCache.client, 'a');

    expect(requests.count).toBe(0);
    expect(listed()).toEqual([group('b')]);
});

test('an edit of a list never loaded writes nothing', async () => {
    await putGroupInCachedList(userCache.client, group('a'));

    expect(listed()).toBeUndefined();
});

test('a group write shows at once, reloads the list and stays in it', async () => {
    const requests = serveGroups([wire('a', 'Server copy'), wire('b')]);
    seed([group('a')]);
    watchList();

    const reload = putGroupAndReloadList(userCache.client, group('a', 'Written'), () => true);

    expect(listed()).toEqual([group('a', 'Written')]);
    await reload;
    expect(requests.count).toBe(1);
    expect(listed()).toEqual([group('a', 'Written'), group('b')]);
});

test('a group write that is no longer current keeps what the reload read', async () => {
    serveGroups([wire('b')]);
    seed([]);
    watchList();

    await putGroupAndReloadList(userCache.client, group('a'), () => false);

    expect(listed()).toEqual([group('b')]);
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

test('a written group becomes its detail and its activity, cut to one page, is marked stale', async () => {
    seedActivity(3);

    await writeGroupDetail(userCache.client, group('a', 'Written'));

    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a', 'Written'));
    expect(userCache.client.getQueryState(activityKey)?.isInvalidated).toBe(true);
    expect(userCache.client.getQueryData<{ pages: unknown[] }>(activityKey)?.pages).toHaveLength(1);
});

test('a written group cancels a running detail read: its older answer is never applied', async () => {
    let answerRead: ((value: Group) => void) | undefined;
    const read = userCache.client
        .fetchQuery({
            queryKey: detailKey,
            queryFn: () =>
                new Promise<Group>(resolve => {
                    answerRead = resolve;
                }),
        })
        .catch(() => undefined);

    await writeGroupDetail(userCache.client, group('a', 'Written'));
    answerRead?.(group('a', 'Older read'));
    await read;

    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a', 'Written'));
});

test('a removed or left group loses its cached detail and activity', () => {
    userCache.client.setQueryData(detailKey, group('a'));
    seedActivity(1);

    forgetGroup(userCache.client, 'a');

    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
    expect(userCache.client.getQueryState(activityKey)).toBeUndefined();
});

test('a group page still showing a removed group keeps it, unread, until it unmounts', () => {
    let detailReads = 0;
    server.use(
        http.get('*/groups/a', () => {
            detailReads += 1;
            return HttpResponse.json({}, { status: 404 });
        }),
    );
    userCache.client.setQueryData(detailKey, group('a'));
    const page = new QueryObserver(userCache.client, { ...groupDetailQueryOptions('a') });
    const unmount = page.subscribe(() => undefined);

    forgetGroup(userCache.client, 'a');

    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a'));
    unmount();
    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
    expect(detailReads).toBe(0);
});

interface GroupServer {
    detailReads: number;
    activityReads: number;
}

/** A group the server no longer lets the user read (left, removed): every read is a 404. */
const serveGoneGroup = (): GroupServer => {
    const reads: GroupServer = { detailReads: 0, activityReads: 0 };

    server.use(
        http.get('*/groups/a/activity-previews', () => {
            reads.activityReads += 1;
            return HttpResponse.json({}, { status: 404 });
        }),
        http.get('*/groups/a', () => {
            reads.detailReads += 1;
            return HttpResponse.json({}, { status: 404 });
        }),
    );
    return reads;
};

/** A group page showing group `a`: its detail and its activity observed. Returns its unmount. */
const mountGroupPage = (): (() => void) => {
    const detail = new QueryObserver(userCache.client, groupDetailQueryOptions('a'));
    const activity = new InfiniteQueryObserver(userCache.client, groupActivityQueryOptions('a'));
    const stopDetail = detail.subscribe(() => undefined);
    const stopActivity = activity.subscribe(() => undefined);

    return () => {
        stopActivity();
        stopDetail();
    };
};

test('a page still showing a left group reads neither its detail nor its activity on focus or reconnect', async () => {
    runAMinuteAfterPageLoad();
    const reads = serveGoneGroup();
    userCache.client.setQueryData(detailKey, group('a'));
    seedActivity(1);
    // Focus and network events reach the cache of a mounted client only.
    userCache.client.mount();
    const unmount = mountGroupPage();

    forgetGroup(userCache.client, 'a');
    // Both are stale now: an enabled observer would read them on focus and on reconnect.
    vi.setSystemTime(Date.now() + 60_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await userCache.client.invalidateQueries({ queryKey: groupsKeys.all });

    expect(reads).toEqual({ detailReads: 0, activityReads: 0 });
    expect(userCache.client.getQueryState(detailKey)?.status).toBe('success');
    unmount();
    userCache.client.unmount();
    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
    expect(userCache.client.getQueryState(activityKey)).toBeUndefined();
});

test('a rejoin while the page of a left group is mounted keeps the fresh detail after it unmounts', async () => {
    runAMinuteAfterPageLoad();
    server.use(
        http.get('*/groups/a/activity-previews', () =>
            HttpResponse.json({ items: [], nextCursor: null }),
        ),
    );
    userCache.client.setQueryData(detailKey, group('a'));
    seedActivity(1);
    const unmount = mountGroupPage();

    forgetGroup(userCache.client, 'a');
    // The join path: the rejoin ends the pending removal, then writes the joined group.
    keepRejoinedGroup(userCache.client, 'a');
    await writeGroupDetail(userCache.client, group('a', 'Rejoined'));
    unmount();

    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a', 'Rejoined'));
    expect(userCache.client.getQueryState(activityKey)?.data).toBeDefined();
});

test('a detail read running when the group is left is cancelled: its late answer keeps nothing', async () => {
    runAMinuteAfterPageLoad();
    let answerRead: (() => void) | undefined;
    server.use(
        http.get(
            '*/groups/a',
            () =>
                new Promise<Response>(resolve => {
                    answerRead = () => {
                        resolve(HttpResponse.json(wire('a', 'Before the leave')));
                    };
                }),
        ),
    );
    userCache.client.setQueryData(detailKey, group('a'));
    const page = new QueryObserver(userCache.client, groupDetailQueryOptions('a'));
    const unmount = page.subscribe(() => undefined);
    void userCache.client.refetchQueries({ queryKey: detailKey });
    await vi.waitFor(() => {
        expect(answerRead).toBeDefined();
    });

    forgetGroup(userCache.client, 'a');
    answerRead?.();
    await vi.waitFor(() => {
        expect(userCache.client.getQueryState(detailKey)?.fetchStatus).toBe('idle');
    });

    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a'));
    unmount();
    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
});

test('a group left twice is still removed once its page unmounts', () => {
    runAMinuteAfterPageLoad();
    const reads = serveGoneGroup();
    userCache.client.setQueryData(detailKey, group('a'));
    seedActivity(1);
    const unmount = mountGroupPage();

    forgetGroup(userCache.client, 'a');
    forgetGroup(userCache.client, 'a');
    unmount();

    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
    expect(userCache.client.getQueryState(activityKey)).toBeUndefined();
    expect(reads).toEqual({ detailReads: 0, activityReads: 0 });
});

test('#879 an update or a cover upload finishing after a leave keeps nothing once the page unmounts', async () => {
    runAMinuteAfterPageLoad();
    const reads = serveGoneGroup();
    userCache.client.setQueryData(detailKey, group('a'));
    seedActivity(1);
    const unmount = mountGroupPage();

    forgetGroup(userCache.client, 'a');
    // An update (or a cover upload) answered after the leave is not a rejoin: it writes nothing
    // into the left group, and its page keeps what it shows until it unmounts.
    await writeGroupDetail(userCache.client, group('a', 'Renamed before the leave'));

    expect(userCache.client.getQueryData(detailKey)).toEqual(group('a'));
    unmount();
    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
    expect(userCache.client.getQueryState(activityKey)).toBeUndefined();
    expect(reads).toEqual({ detailReads: 0, activityReads: 0 });
});

test('#879 a success of the detail after a leave, other than a rejoin, does not keep the left group', () => {
    runAMinuteAfterPageLoad();
    const reads = serveGoneGroup();
    userCache.client.setQueryData(detailKey, group('a'));
    seedActivity(1);
    const unmount = mountGroupPage();

    forgetGroup(userCache.client, 'a');
    // A success of the detail that is not the join path (a write by hand, as a late read would).
    userCache.client.setQueryData(detailKey, group('a', 'Late write'));
    unmount();

    expect(userCache.client.getQueryState(detailKey)).toBeUndefined();
    expect(userCache.client.getQueryState(activityKey)).toBeUndefined();
    expect(reads).toEqual({ detailReads: 0, activityReads: 0 });
});
