// Spec 03 §1.5: each store-migration PR removes its own line from `resetAuthScopedStores` together
// with the store (no line, no store). 03-9b2 removed the users store, 03-11 the groups store.
import { expect, test } from 'vitest';

import authStoreSource from './authStore.ts?raw';

const usersStoreFiles = import.meta.glob('./users-store/**');
const groupsStoreFiles = import.meta.glob('./groupsStore*.ts');

const resetAuthScopedStoresBody = (): string => {
    const start = authStoreSource.indexOf('const resetAuthScopedStores = () => {');
    const end = authStoreSource.indexOf('};', start);

    return authStoreSource.slice(start, end);
};

test('the users store is gone, and so is its line in resetAuthScopedStores', () => {
    expect(Object.keys(usersStoreFiles)).toEqual([]);
    expect(resetAuthScopedStoresBody()).toContain('resetActivity');
    expect(resetAuthScopedStoresBody()).not.toMatch(/users/i);
});

test('the groups store is gone, and so is its line in resetAuthScopedStores', () => {
    expect(Object.keys(groupsStoreFiles)).toEqual([]);
    expect(resetAuthScopedStoresBody()).not.toMatch(/groups/i);
});
