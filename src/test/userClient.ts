// Test support: registers a test QueryClient as the signed-in user's persisted client (as
// `clientFor` does), so the user-only queries (`isUserCacheClient`) send their requests. The
// registration is dropped after each test of a file that imports this module.
import type { QueryClient } from '@tanstack/react-query';
import { afterEach } from 'vitest';

import { cachesByUser } from 'shared/offline/userCaches';

import { getDefaultTestQueryClient } from './renderWithQueryClient';

const registered = new Set<string>();

export const mountAsUserClient = (
    userId = 'user-1',
    client: QueryClient = getDefaultTestQueryClient(),
): QueryClient => {
    cachesByUser.set(userId, {
        client,
        ready: Promise.resolve(),
        isReady: true,
        listeners: new Set(),
        unsubscribe: null,
        disposed: false,
    });
    registered.add(userId);
    return client;
};

afterEach(() => {
    registered.forEach(userId => cachesByUser.delete(userId));
    registered.clear();
});
