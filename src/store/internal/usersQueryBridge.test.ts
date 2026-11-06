import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import type { SelfUser } from 'entities/users';
import { selfUserQueryOptions, usersKeys } from 'entities/users';
import { clearLocalUserIdentity, getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';
import { clientFor } from 'shared/offline/restore';
import { cachesByUser } from 'shared/offline/userCaches';
import { setupMswServer } from 'test/mswServer';

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

const server = setupMswServer();

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

    expect(getCachedSelfUser(undefined)).toBeUndefined();

    seedSelfUser(userWith(id));
    clientFor(id);

    expect(getCachedSelfUser(undefined)).toBeUndefined();

    saveLocalUser({ id, settings: userWith(id).settings });

    expect(getCachedSelfUser(undefined)).toEqual(userWith(id));
});

test('prefers the in-memory id of the users store over the shared LocalUser', () => {
    const mine = freshId('mine');
    const other = freshId('other-tab');

    seedSelfUser(userWith(mine, 'Mine'));
    seedSelfUser(userWith(other, 'Other'));
    clientFor(mine);
    clientFor(other);
    // Another tab switched the account: the shared LocalUser is the other user now.
    saveLocalUser({ id: other, settings: userWith(other).settings });

    expect(getCachedSelfUser(mine)?.displayName).toBe('Mine');
    expect(getCachedSelfUser(undefined)?.displayName).toBe('Other');
});

// A focus refetch that started before a settings change answers with the old user: it must not
// overwrite the newer seeded user, nor write the old settings to LocalUser.
test('a refetch in flight does not overwrite a newer seeded user', async () => {
    const id = freshId('in-flight');
    const client = clientFor(id);
    const stale = userWith(id, 'Stale');
    let respond: () => void = () => undefined;

    server.use(
        http.get(
            '*/users/self',
            () =>
                new Promise<Response>(resolve => {
                    respond = () => {
                        resolve(HttpResponse.json({ ...stale, isPremium: false }));
                    };
                }),
        ),
    );
    saveLocalUser({ id, role: 'USER', settings: stale.settings });
    const refetch = client.prefetchQuery(selfUserQueryOptions());
    await new Promise(resolve => setTimeout(resolve, 10));
    const fresh = { ...userWith(id, 'Fresh'), settings: { ...stale.settings, language: 'ru' } };

    seedSelfUser(fresh);
    respond();
    await refetch;

    expect(client.getQueryData(usersKeys.self())).toEqual(fresh);
    expect(getLocalUser()?.settings.language).toBe('en');
});
