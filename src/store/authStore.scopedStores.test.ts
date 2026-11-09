// Spec 03 §1.5: each store-migration PR removes its own line from `resetAuthScopedStores` together
// with the store (no line, no store). 03-9b2 removed the users store.
import { expect, test } from 'vitest';

import authStoreSource from './authStore.ts?raw';

const storeFiles = import.meta.glob('./users-store/**');

const resetAuthScopedStoresBody = (): string => {
    const start = authStoreSource.indexOf('const resetAuthScopedStores = () => {');
    const end = authStoreSource.indexOf('};', start);

    return authStoreSource.slice(start, end);
};

test('the users store is gone, and so is its line in resetAuthScopedStores', () => {
    expect(Object.keys(storeFiles)).toEqual([]);
    expect(resetAuthScopedStoresBody()).toContain('setInitialGroupsStore');
    expect(resetAuthScopedStoresBody()).not.toMatch(/users/i);
});
