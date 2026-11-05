// The per-user cache registry (spec 03 §1.5): shared by `restore` (creates the entries) and
// `clearUserData` (drops them). It imports no persister code, so `clearUserData` stays light enough
// for the auth store, which is on the landing path.
import type { QueryClient } from '@tanstack/react-query';

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

// IndexedDB keys whose writes are dropped: a throttled persist scheduled before `clearUserData`
// would otherwise bring the user's data back after the `del`.
const blockedWriteKeys = new Set<string>();

export const blockCacheWrites = (key: string): void => {
    blockedWriteKeys.add(key);
};

export const unblockCacheWrites = (key: string): void => {
    blockedWriteKeys.delete(key);
};

export const isCacheWriteBlocked = (key: string): boolean => blockedWriteKeys.has(key);
