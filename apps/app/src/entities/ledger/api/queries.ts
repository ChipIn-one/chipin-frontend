// The backend capabilities (spec 03 §2.7): the optional contract features this deployment has
// switched on, read from `GET /health`. They decide whether offline writes are available; nothing
// mounts the query: the outbox path reads it from the cache (and fetches it) only while
// `VITE_FEATURE_OFFLINE_WRITES` is on, and an online create never carries a client `id`.
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api, ApiError, publicApi } from 'shared/api/client';
import { ledgerEntryKey } from 'shared/offline/outboxRegistry';

import { type LedgerEntry, toLedgerEntry } from '../model/toLedgerEntry';

import { dropDeletedConflictDraft } from './conflictDrafts';

const CAPABILITIES_STALE_TIME = 10 * 60_000;

export const capabilitiesKeys = {
    all: ['meta', 'capabilities'] as const,
};

/** The capability names of spec 03 §7.0. */
export type BackendCapability =
    'ledger.clientEntryId' | 'ledger.entryVersion' | 'client.minVersion';

/** Persisted with the user's cache; a `/health` answer without the field means none. */
export const capabilitiesQueryOptions = () =>
    queryOptions({
        queryKey: capabilitiesKeys.all,
        staleTime: CAPABILITIES_STALE_TIME,
        queryFn: ({ signal }): Promise<string[]> =>
            publicApi('get', '/health', { signal }).then(health =>
                Array.isArray(health.capabilities) ? health.capabilities : [],
            ),
    });

/** Whether the backend has the capability; false until `/health` has answered. The only reader. */
export const useBackendCapability = (name: BackendCapability): boolean =>
    useQuery({
        ...capabilitiesQueryOptions(),
        select: capabilities => capabilities.includes(name),
    }).data ?? false;

const LEDGER_ENTRY_STALE_TIME = 30_000;

/** §1.3, §2.2: the ledger keys; `entry` is the key the outbox registry reads (one definition). */
export const ledgerKeys = {
    all: ['ledger'] as const,
    entry: (entryId: string) => ledgerEntryKey(entryId),
};

/**
 * `GET /ledger/entries/{id}` as the domain entry: its type and version (§2.1, §2.2). A 404 drops the
 * entry's conflict draft (§2.6; with offline writes on and a draft only).
 */
export const ledgerEntryQueryOptions = (entryId: string) =>
    queryOptions({
        queryKey: ledgerKeys.entry(entryId),
        staleTime: LEDGER_ENTRY_STALE_TIME,
        queryFn: ({ signal }): Promise<LedgerEntry> =>
            api('get', '/ledger/entries/{id}', { params: { id: entryId }, signal }).then(
                toLedgerEntry,
                (error: unknown) => {
                    if (error instanceof ApiError && error.status === 404) {
                        void dropDeletedConflictDraft(entryId);
                    }
                    throw error;
                },
            ),
    });

/**
 * Observes `ledger.entry(id)` of an expense the user may edit or delete (§2.9 C2-33: an outbox edit
 * or delete needs it), so it is read again with the views that show it (focus, reconnect, an
 * invalidation; R1 L3). The result is not used. The caller mounts it only while offline writes are
 * available (`useIsOfflineWriteAvailable`): otherwise nothing is read or added to the cache.
 */
export const useLedgerEntryObserver = (entryId: string): void => {
    useQuery(ledgerEntryQueryOptions(entryId));
};
