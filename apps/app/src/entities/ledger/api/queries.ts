// The backend capabilities (spec 03 §2.7): the optional contract features this deployment has
// switched on, read from `GET /health`. They decide whether offline writes are available; until
// the outbox (03-15a) nothing mounts the query, and a create never carries a client `id`.
import { queryOptions, useQuery } from '@tanstack/react-query';

import { publicApi } from 'shared/api/client';

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
