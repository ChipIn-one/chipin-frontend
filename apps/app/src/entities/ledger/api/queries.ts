// The backend capabilities (spec 03 §2.7): the optional contract features this deployment has
// switched on, read from `GET /health`. They decide whether offline writes are available; nothing
// mounts the query: the outbox path reads it from the cache (and fetches it) only while
// `VITE_FEATURE_OFFLINE_WRITES` is on, and an online create never carries a client `id`.
import { useEffect } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, publicApi } from 'shared/api/client';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { ledgerEntryKey } from 'shared/offline/outboxRegistry';

import { type LedgerEntry, toLedgerEntry } from '../model/toLedgerEntry';

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

/** `GET /ledger/entries/{id}` as the domain entry: its type and version (§2.1, §2.2). */
export const ledgerEntryQueryOptions = (entryId: string) =>
    queryOptions({
        queryKey: ledgerKeys.entry(entryId),
        staleTime: LEDGER_ENTRY_STALE_TIME,
        queryFn: ({ signal }): Promise<LedgerEntry> =>
            api('get', '/ledger/entries/{id}', { params: { id: entryId }, signal }).then(
                toLedgerEntry,
            ),
    });

/**
 * Reads the expense the user may edit or delete into `ledger.entry(id)` (§2.9 C2-33: an outbox
 * edit or delete needs it; a fresh entry is not read again). Only with the flag
 * `VITE_FEATURE_OFFLINE_WRITES` on: off, nothing is read or added to the cache.
 */
export const useLedgerEntryForWrites = (entryId: string | null): void => {
    const client = useQueryClient();

    useEffect(() => {
        if (entryId !== null && isOfflineWritesFlagOn()) {
            void client.prefetchQuery(ledgerEntryQueryOptions(entryId));
        }
    }, [client, entryId]);
};
