import { afterEach, expect, test } from 'vitest';

import type { SelfUser } from 'entities/users';
import { usersKeys } from 'entities/users';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';
import { clientFor } from 'shared/offline/restore';
import { cachesByUser } from 'shared/offline/userCaches';

import { getCachedSelfUser, seedSelfUser } from './usersQueryBridge';

import 'fake-indexeddb/auto';

const userWith = (id: string, displayName = 'User'): SelfUser => ({
    id,
    email: `${id}@example.com`,
    displayName,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: `invite-${id}`,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
});

const usedIds: string[] = [];
const freshId = (name: string): string => {
    const id = `${name}-${usedIds.length}`;

    usedIds.push(id);
    return id;
};

afterEach(() => {
    usedIds.forEach(id => {
        cachesByUser.get(id)?.client.clear();
        cachesByUser.delete(id);
    });
    usedIds.length = 0;
    clearLocalUserIdentity();
});

test("writes the user into their existing client's users.self", () => {
    const id = freshId('existing');
    const client = clientFor(id);

    seedSelfUser(userWith(id, 'Ann'));

    expect(client.getQueryData(usersKeys.self())).toEqual(userWith(id, 'Ann'));
    expect(client.getQueryState(usersKeys.self())?.isInvalidated).toBe(false);
});

// A first sign-in: the store learns the id from `users/self` before the remount creates the
// client, so the remounted tree reads the seeded user instead of sending a second request.
test('a user seeded before their client exists is in the client once it is created', () => {
    const id = freshId('first-sign-in');

    seedSelfUser(userWith(id, 'Old'));
    seedSelfUser(userWith(id, 'New'));

    expect(cachesByUser.has(id)).toBe(false);
    expect(clientFor(id).getQueryData(usersKeys.self())).toEqual(userWith(id, 'New'));
});

test('clearUserData drops a seed still waiting for the client', () => {
    const id = freshId('cleared');

    seedSelfUser(userWith(id));
    void clearUserData(id, () => undefined);

    expect(clientFor(id).getQueryData(usersKeys.self())).toBeUndefined();
});

test('getCachedSelfUser reads the users.self of the cached LocalUser only', () => {
    const id = freshId('cached');

    expect(getCachedSelfUser()).toBeUndefined();

    seedSelfUser(userWith(id));
    clientFor(id);

    expect(getCachedSelfUser()).toBeUndefined();

    saveLocalUser({ id, settings: userWith(id).settings });

    expect(getCachedSelfUser()).toEqual(userWith(id));
});
