// The per-user cache registry (spec 03 §1.5): shared by `restore` (creates the entries) and
// `clearUserData` (drops them). It imports no persister code, so `clearUserData` stays light enough
// for the auth store, which is on the landing path.
import type { QueryClient } from '@tanstack/react-query';

import { queryCacheKey } from './constants';

export interface UserCache {
    client: QueryClient;
    ready: Promise<void>;
    isReady: boolean;
    listeners: Set<() => void>;
    /** Stops saving the cache (`clearUserData`); null until the restore has settled. */
    unsubscribe: (() => void) | null;
    /** Set by `clearUserData`: a restore that settles later does not subscribe. */
    disposed: boolean;
}

export const cachesByUser = new Map<string, UserCache>();

// Data the legacy stores load before the user's client exists (a first sign-in learns the user id
// from `users/self`, and the client is created by the remount that id causes): applied when
// `restore` creates the client, before its restore (a newer entry is not overwritten by it).
type CacheSeed = (client: QueryClient) => void;

const pendingSeeds = new Map<string, CacheSeed>();

/** Writes into the user's client now, or when it is created; the latest seed per user wins. */
export const seedUserCache = (userId: string, seed: CacheSeed): void => {
    const entry = cachesByUser.get(userId);

    if (entry) {
        seed(entry.client);
        return;
    }
    pendingSeeds.set(userId, seed);
};

/** The seed waiting for the user's new client, removed from the queue. */
export const takePendingSeed = (userId: string): CacheSeed | undefined => {
    const seed = pendingSeeds.get(userId);

    pendingSeeds.delete(userId);
    return seed;
};

// IndexedDB keys whose writes are dropped: a throttled persist scheduled before `clearUserData`
// would otherwise bring the user's data back after the `del`.
const blockedWriteKeys = new Set<string>();

export const blockCacheWrites = (key: string): void => {
    blockedWriteKeys.add(key);
};

export const unblockCacheWrites = (key: string): void => {
    blockedWriteKeys.delete(key);
};

// The shared cached user (`LocalUser.id`), wired by `bootstrap/initializeApi`: `shared` cannot read
// `helpers/localStorage` itself. Another tab that switched the account changes it, so a tab still
// holding the previous user's client does not rewrite that user's cache. The id survives an
// expiry, so an expired session keeps saving its own cache.
let readCacheOwner: (() => string | undefined) | null = null;

export const setCacheOwnerReader = (reader: (() => string | undefined) | null): void => {
    readCacheOwner = reader;
};

/** Whether a query cache write to `key` may happen (no reader wired: only the block applies). */
export const isCacheWriteAllowed = (key: string): boolean => {
    if (blockedWriteKeys.has(key)) {
        return false;
    }
    if (!readCacheOwner) {
        return true;
    }
    const owner = readCacheOwner();

    return owner !== undefined && key === queryCacheKey(owner);
};

// `offline.persist_failed` is reported once per session, by the persister and `clearUserData` alike.
let persistFailureReported = false;

/** True the first time in a session: the caller reports, later callers stay quiet. */
export const claimPersistFailureReport = (): boolean => {
    if (persistFailureReported) {
        return false;
    }
    persistFailureReported = true;
    return true;
};

/** Tests only: forget that this session already reported a persist failure. */
export const resetPersistFailureFlag = (): void => {
    persistFailureReported = false;
};
