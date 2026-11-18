// Test support: runs the production restore handler on a user's client, as the startup restore
// does. The handler is registered as `bootstrap/initializeApi` wires it, run through
// `runCacheRestored` (what `shared/offline/restore` calls after a restore), then unregistered.
import type { QueryClient } from '@tanstack/react-query';

import { reconcileRestoredSelf } from 'entities/users';
import { runCacheRestored, setCacheRestoredHandler } from 'shared/offline/userCaches';

export const runCacheRestoredHandler = (client: QueryClient, userId: string): void => {
    setCacheRestoredHandler(reconcileRestoredSelf);
    try {
        runCacheRestored(client, userId);
    } finally {
        setCacheRestoredHandler(null);
    }
};
