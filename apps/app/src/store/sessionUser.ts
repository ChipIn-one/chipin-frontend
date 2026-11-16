// The signed-in user of this tab (spec 03 §1.5, §6 row 3): the session start loads the self user
// and marks the known users stale on that user's QueryClient, and the legacy store actions read
// the cached users there. The tab's user is `getTabUserId()` (this tab's own `LocalUser` writes),
// then the shared `LocalUser.id`.
import type { QueryClient } from '@tanstack/react-query';

import {
    fetchSelfUser,
    isSelfWritePending,
    type KnownUser,
    type SelfUser,
    selfUserQueryOptions,
    usersKeys,
} from 'entities/users';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { getLocalUser, getTabUserId, saveLocalUser, toLocalUser } from 'helpers/localStorage';
import { cachesByUser, seedUserCache, takePendingSeed } from 'shared/offline/userCaches';

/** The signed-in (or last) user of this tab; a sign-out in this tab has cleared it. */
export const cachedUserId = (): string | undefined => getTabUserId() ?? getLocalUser()?.id;

const userClient = (userId: string | undefined): QueryClient | undefined =>
    userId === undefined ? undefined : cachesByUser.get(userId)?.client;

/** The persisted client of this tab's user; none before a first sign-in learns the id. */
export const tabUserClient = (): QueryClient | undefined => userClient(cachedUserId());

const loadedSince = (client: QueryClient, queryKey: readonly unknown[], since: number): boolean =>
    (client.getQueryState(queryKey)?.dataUpdatedAt ?? 0) >= since;

// A session start brings back the role an expiry dropped from the cached user (spec 03 §1.5); the
// self writes never change the role, so a write confirmed meanwhile does not matter here.
const restoreLocalRole = (user: SelfUser): void => {
    const cached = getLocalUser();

    if (cached?.id === user.id && cached.role !== user.role) {
        saveLocalUser({ ...cached, role: user.role });
    }
};

// The client of the tab's user exists: its self query loads the user (its `queryFn` keeps the
// cached `LocalUser` in step), so a mount fetch already running is joined, and one that finished
// after `since` is reused: one request. A self write still pending is newer than any load, and one
// confirmed during the load cancels it (cancel before set, `entities/users` mutations).
const loadIntoClient = (
    client: QueryClient,
    since: number,
    sessionVersion: number,
): Promise<SelfUser | null> => {
    const cached = (): SelfUser | null => client.getQueryData<SelfUser>(usersKeys.self()) ?? null;

    if (isSelfWritePending(client)) {
        const user = cached();

        if (user && isAuthSessionCurrent(sessionVersion)) {
            restoreLocalRole(user);
        }
        return Promise.resolve(user);
    }
    return client
        .fetchQuery({ ...selfUserQueryOptions(), staleTime: Math.max(Date.now() - since, 0) })
        .then(
            user => {
                if (isAuthSessionCurrent(sessionVersion)) {
                    restoreLocalRole(user);
                }
                return user;
            },
            // Cancelled (a self write, a sign-out) or failed: the page shows what is cached.
            cached,
        );
};

// Whether the loaded user may replace the client's entry: not while a self write is pending, and
// not over an entry written after the load started (a write confirmed meanwhile).
const mayReplaceSelf = (client: QueryClient, startedAt: number): boolean =>
    !isSelfWritePending(client) && !loadedSince(client, usersKeys.self(), startedAt);

// No client of the tab's user yet: a first sign-in (the id comes with this response) or an
// account switch (the remount onto the new user's client is still to come). The new client joins
// this request (a pending seed) instead of sending its own, and gets the user when it arrives.
const loadBeforeClient = (
    expectedUserId: string | undefined,
    sessionVersion: number,
): Promise<SelfUser | null> => {
    const startedAt = Date.now();
    const request = fetchSelfUser();
    const loaded = request.then(user => {
        if (expectedUserId !== undefined && expectedUserId !== user.id) {
            takePendingSeed(expectedUserId);
        }
        // The session ended during the load (signed out, expired, switched): nothing is written.
        if (!isAuthSessionCurrent(sessionVersion)) {
            return user;
        }
        const client = userClient(user.id);

        if (client && !mayReplaceSelf(client, startedAt)) {
            restoreLocalRole(user);
            return client.getQueryData<SelfUser>(usersKeys.self()) ?? user;
        }
        const updatedAt = Date.now();

        if (client) {
            // The joined load (or a refetch) still in flight read the user before this response.
            void client.cancelQueries({ queryKey: usersKeys.self() });
            client.setQueryData(usersKeys.self(), user, { updatedAt });
        } else {
            seedUserCache(user.id, created => {
                created.setQueryData(usersKeys.self(), user, { updatedAt });
            });
        }
        // `LocalUser.id` becomes this tab's user: the app remounts onto that user's client.
        saveLocalUser(toLocalUser(user));
        return user;
    });

    if (expectedUserId !== undefined) {
        seedUserCache(expectedUserId, created => {
            // eslint-disable-next-line @tanstack/query/exhaustive-deps -- `request` is the session load in flight, handed to the new client; the key is the user's entry.
            void created.prefetchQuery({
                queryKey: usersKeys.self(),
                // Another user's answer (the token's `sub` was not this user) is not this entry.
                queryFn: () =>
                    request.then(user =>
                        user.id === expectedUserId
                            ? user
                            : Promise.reject(new Error('Self user of another account')),
                    ),
                retry: false,
            });
        });
    }
    return loaded.catch(() => null);
};

export interface SessionSelfLoad {
    /** `idle` before any session load of this tab; `failed`: no user (the load failed). */
    status: 'idle' | 'loading' | 'loaded' | 'failed';
    /** The user the last load resolved with (or the cached one it fell back to). */
    user: SelfUser | null;
}

// The latest session load, for the readers that have no user client to ask: a first sign-in
// whose load failed stays on the anonymous client (no id to remount onto), and the public pages
// run there. Only the latest load writes it.
let sessionSelfLoad: SessionSelfLoad = { status: 'idle', user: null };
let sessionLoadGeneration = 0;
const sessionLoadListeners = new Set<() => void>();

const setSessionSelfLoad = (next: SessionSelfLoad): void => {
    sessionSelfLoad = next;
    sessionLoadListeners.forEach(listener => {
        listener();
    });
};

/** The state of the latest session self load (a stable object until it changes). */
export const getSessionSelfLoad = (): SessionSelfLoad => sessionSelfLoad;

/** Calls `listener` when the session self load changes; returns the unsubscribe. */
export const subscribeSessionSelfLoad = (listener: () => void): (() => void) => {
    sessionLoadListeners.add(listener);
    return () => {
        sessionLoadListeners.delete(listener);
    };
};

/**
 * Loads the self user once per session start (sign-in, the startup session check, the reconnect
 * of an offline-cached session, another tab's account switch), and on a Retry before the user's
 * client exists. `since`: when this session start began; a load finished after it is reused.
 * Resolves with the user (null when the load failed and nothing is cached); never rejects.
 */
export const loadSelfUserForSession = (since: number = Date.now()): Promise<SelfUser | null> => {
    const sessionVersion = getAuthSessionVersion();
    const userId = getTabUserId();
    const client = userClient(userId);
    const generation = ++sessionLoadGeneration;

    setSessionSelfLoad({ status: 'loading', user: null });
    const loaded = client
        ? loadIntoClient(client, since, sessionVersion)
        : loadBeforeClient(userId, sessionVersion);

    return loaded.then(user => {
        if (generation === sessionLoadGeneration) {
            setSessionSelfLoad({ status: user ? 'loaded' : 'failed', user });
        }
        return user;
    });
};

/**
 * Marks the user's `users.known` stale at a session start: a load running is joined and one that
 * finished after `since` is reused, so a session start sends one request. No client yet (a first
 * sign-in) is a no-op: its first mount loads them. Never rejects.
 */
export const loadKnownUsersForSession = (since: number = Date.now()): Promise<void> => {
    const client = tabUserClient();

    if (!client || loadedSince(client, usersKeys.known(), since)) {
        return Promise.resolve();
    }
    return client.invalidateQueries({ queryKey: usersKeys.known() }, { cancelRefetch: false });
};

/**
 * After a legacy change of the friends or their balances: an active `users.known` refetches now,
 * an inactive one on its next mount. A running load may predate the change, so it is cancelled
 * first (`cancelRefetch` alone restarts it only when the entry has data). Never rejects.
 */
export const invalidateKnownUsers = (): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    const queryKey = usersKeys.known();

    return client
        .cancelQueries({ queryKey })
        .then(() => client.invalidateQueries({ queryKey }, { cancelRefetch: true }));
};

/** The cached self user of this tab's user, for legacy store actions. */
export const getCachedSelfUser = (): SelfUser | undefined =>
    tabUserClient()?.getQueryData<SelfUser>(usersKeys.self());

/** The cached known users of this tab's user, for legacy store actions (the expense editor). */
export const getCachedKnownUsers = (): KnownUser[] | undefined =>
    tabUserClient()?.getQueryData<KnownUser[]>(usersKeys.known());

/**
 * Forgets the session self load on every transition to unauthenticated (`resetAuthScopedStores`):
 * no user stays in memory after a sign-out (invariant 12), and a load still in flight can no longer
 * set it.
 */
export const resetSessionSelfLoad = (): void => {
    sessionLoadGeneration += 1;
    setSessionSelfLoad({ status: 'idle', user: null });
};
