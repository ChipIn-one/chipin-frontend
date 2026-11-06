import { QueryObserver } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import type { SelfUser } from 'entities/users';
import { knownUsersQueryOptions, selfUserQueryOptions, usersKeys } from 'entities/users';
import { clearLocalUserIdentity, getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';
import { clientFor } from 'shared/offline/restore';
import { cachesByUser } from 'shared/offline/userCaches';
import { createKnownUser } from 'test/knownUsers';
import { setupMswServer } from 'test/mswServer';

import {
    getCachedKnownUsers,
    getCachedSelfUser,
    invalidateKnownUsers,
    seedSelfUser,
} from './usersQueryBridge';

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

    // As the store does: the new user goes to LocalUser, then into the query.
    saveLocalUser({ id, role: 'USER', settings: fresh.settings });
    seedSelfUser(fresh);
    respond();
    await refetch;

    expect(client.getQueryData(usersKeys.self())).toEqual(fresh);
    expect(getLocalUser()?.settings.language).toBe('ru');
});

const wireFriend = (id: string) => ({
    user: { id, email: `${id}@example.com`, displayName: id, createdAt: 1, updatedAt: 1 },
    balances: [],
    lastUsedCurrency: null,
});

const countKnownRequests = (): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/users/known-users', () => {
            counter.count += 1;
            return HttpResponse.json({ friends: [] });
        }),
    );
    return counter;
};

test('invalidating the known users without a client of the user is a no-op', async () => {
    const requests = countKnownRequests();

    await expect(invalidateKnownUsers(freshId('no-client'))).resolves.toBeUndefined();
    expect(requests.count).toBe(0);
});

test("marks the user's inactive users.known stale without a request, the in-memory user first", async () => {
    const id = freshId('inactive');
    const other = freshId('other');
    const client = clientFor(id);
    const requests = countKnownRequests();
    saveLocalUser({ id: other, role: 'USER', settings: userWith(other).settings });
    client.setQueryData(usersKeys.known(), [createKnownUser('friend-1')]);

    await invalidateKnownUsers(id);

    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
    expect(requests.count).toBe(0);
    expect(getCachedKnownUsers(id)).toEqual([createKnownUser('friend-1')]);
    // Without the in-memory id the cached `LocalUser` decides: another user, no data.
    expect(getCachedKnownUsers(undefined)).toBeUndefined();
});

test('a session start joins a known users load already running: one request', async () => {
    const id = freshId('running');
    const client = clientFor(id);
    const requests = countKnownRequests();
    client.setQueryData(usersKeys.known(), []);
    const stop = new QueryObserver(client, knownUsersQueryOptions()).subscribe(() => undefined);

    const load = client.refetchQueries({ queryKey: usersKeys.known() });
    await invalidateKnownUsers(id, { joinRunning: true });
    await load;

    expect(requests.count).toBe(1);
    stop();
});

test('after a change a running FIRST load is cancelled and reloaded: the second result wins', async () => {
    const id = freshId('first-load');
    const client = clientFor(id);
    let count = 0;
    server.use(
        http.get('*/users/known-users', async () => {
            count += 1;
            const call = count;

            // The pre-change load answers last: it must not win.
            await new Promise(resolve => setTimeout(resolve, call === 1 ? 30 : 0));
            return HttpResponse.json({
                friends: call === 1 ? [] : [wireFriend('friend-new')],
            });
        }),
    );
    const stop = new QueryObserver(client, knownUsersQueryOptions()).subscribe(() => undefined);

    await invalidateKnownUsers(id);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(count).toBe(2);
    expect(
        client.getQueryData(knownUsersQueryOptions().queryKey)?.map(friend => friend.user.id),
    ).toEqual(['friend-new']);
    stop();
});

test('after a change a running known users load is restarted: it may predate the change', async () => {
    const id = freshId('restart');
    const client = clientFor(id);
    const requests = countKnownRequests();
    client.setQueryData(usersKeys.known(), []);
    const stop = new QueryObserver(client, knownUsersQueryOptions()).subscribe(() => undefined);

    const load = client.refetchQueries({ queryKey: usersKeys.known() });
    await invalidateKnownUsers(id);
    await load;

    expect(requests.count).toBe(2);
    stop();
});

test('refetches an active users.known now', async () => {
    const id = freshId('active');
    const client = clientFor(id);
    const requests = countKnownRequests();
    client.setQueryData(usersKeys.known(), []);
    // An active query: an enabled observer of fresh data (its mount sends nothing).
    const stop = new QueryObserver(client, knownUsersQueryOptions()).subscribe(() => undefined);

    await invalidateKnownUsers(id);

    expect(requests.count).toBe(1);
    stop();
});
