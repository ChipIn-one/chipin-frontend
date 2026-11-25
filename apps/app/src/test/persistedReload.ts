// Test support: a reload through the production cache persist path (`dehydrateOptions` and
// `trimmingPersister`, serialized by `persistCodec` and read back by the persister's validated
// reader), with the persisted string kept in memory instead of IndexedDB.
import type { QueryClient } from '@tanstack/react-query';
import {
    type PersistedClient,
    persistQueryClientRestore,
    persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import { persistCodec } from 'shared/offline/persistCodec';
import {
    dehydrateOptions,
    deserializePersistedClient,
    trimmingPersister,
} from 'shared/offline/queryPersister';

/** Persists `source` as the app does and restores the result into `target`. */
export const reloadThroughPersister = async (
    source: QueryClient,
    target: QueryClient,
): Promise<void> => {
    let stored: string | undefined;
    const persister = trimmingPersister({
        persistClient: (persisted: PersistedClient) => {
            stored = persistCodec.stringify(persisted);
        },
        restoreClient: () =>
            stored === undefined ? undefined : deserializePersistedClient(stored),
        removeClient: () => {
            stored = undefined;
        },
    });

    await persistQueryClientSave({ queryClient: source, persister, dehydrateOptions });
    await persistQueryClientRestore({ queryClient: target, persister });
};
