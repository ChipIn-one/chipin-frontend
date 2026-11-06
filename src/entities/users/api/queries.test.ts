import { dehydrate, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import { clearLocalUserIdentity, getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { dehydrateOptions } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';

import { selfUserQueryOptions, USERS_QUERY_DEFAULTS, usersKeys } from './queries';

const server = setupMswServer();

const wireSettings = {
    defaultCurrency: 'EUR',
    defaultCategory: 'transport',
    timeFormat: '24h',
    language: 'ru',
    theme: 'dark',
    simplifyDebts: false,
    skipCategory: true,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'female',
} as const;
const wireUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'ADMIN',
    isPremium: false,
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: wireSettings,
    createdAt: 1,
    updatedAt: 2,
};

const serveSelf = (body: Record<string, unknown>) => {
    server.use(http.get('*/users/self', () => HttpResponse.json(body)));
};

afterEach(() => {
    clearLocalUserIdentity();
});

test("the users keys start with 'users' and follow the defaults table", () => {
    expect(usersKeys.self()).toEqual(['users', 'self']);
    expect(usersKeys.known()).toEqual(['users', 'known']);
    expect(usersKeys.premiumPromo()).toEqual(['users', 'premiumPromo']);
    expect(USERS_QUERY_DEFAULTS).toEqual({
        self: { staleTime: 5 * 60_000, persist: true },
        known: { staleTime: 60_000, persist: true },
        premiumPromo: { staleTime: 10 * 60_000, persist: false },
    });

    const options = selfUserQueryOptions();

    expect(options.queryKey).toEqual(usersKeys.self());
    expect(options.staleTime).toBe(5 * 60_000);
    // The users store loads the self user at session start and seeds the entry (03-9b removes it).
    expect(options.refetchOnMount).toBe(false);
    // A reconnect reloads it through the store as well (`useCheckSignIn`): one request.
    expect(options.refetchOnReconnect).toBe(false);
});

test('loads the self user as the domain model and keeps it in the persisted cache', async () => {
    serveSelf(wireUser);
    const client = new QueryClient();

    const user = await client.fetchQuery(selfUserQueryOptions());

    expect(user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User',
        picture: null,
        role: 'ADMIN',
        subscriptionUntil: null,
        inviteToken: 'invite-token',
        settings: wireSettings,
        createdAt: 1,
        updatedAt: 2,
    });
    expect(dehydrate(client, dehydrateOptions).queries.map(query => query.queryKey)).toEqual([
        usersKeys.self(),
    ]);
});

test('an unknown theme reads as system', async () => {
    serveSelf({ ...wireUser, settings: { ...wireSettings, theme: 'sepia' } });

    const user = await new QueryClient().fetchQuery(selfUserQueryOptions());

    expect(user.settings.theme).toBe('system');
});

test("a refetch updates the cached LocalUser of the same user, never another user's", async () => {
    serveSelf(wireUser);
    saveLocalUser({
        id: 'user-1',
        role: 'USER',
        settings: { ...wireSettings, theme: 'light', timeFormat: '12h', defaultCategory: 'food' },
    });

    await new QueryClient().fetchQuery(selfUserQueryOptions());

    expect(getLocalUser()).toEqual({ id: 'user-1', role: 'ADMIN', settings: wireSettings });

    const otherSettings = { ...wireSettings, language: 'en' };

    saveLocalUser({ id: 'user-2', role: 'USER', settings: otherSettings });
    await new QueryClient().fetchQuery(selfUserQueryOptions());

    expect(getLocalUser()).toEqual({ id: 'user-2', role: 'USER', settings: otherSettings });
});

test('a refetch never brings back a role the cached user dropped (session expiry)', async () => {
    serveSelf(wireUser);
    saveLocalUser({ id: 'user-1', settings: wireSettings });

    await new QueryClient().fetchQuery(selfUserQueryOptions());

    expect(getLocalUser()).toEqual({ id: 'user-1', settings: wireSettings });
});
