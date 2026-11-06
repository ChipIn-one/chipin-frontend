import { dehydrate, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import { clearLocalUserIdentity, getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { currencyCode, fromUnits } from 'shared/money';
import { persistCodec } from 'shared/offline/persistCodec';
import { dehydrateOptions } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';

import {
    knownUsersQueryOptions,
    premiumPromoQueryOptions,
    selfUserQueryOptions,
    USERS_QUERY_DEFAULTS,
    usersKeys,
} from './queries';

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
    // The query defaults decide: a mount and a reconnect refetch a stale entry (the session
    // loader joins or reuses that load, `store/internal/sessionUser`).
    expect(options.refetchOnMount).toBeUndefined();
    expect(options.refetchOnReconnect).toBeUndefined();
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

test('the known users and premium promo options follow the defaults table', () => {
    const known = knownUsersQueryOptions();
    const promo = premiumPromoQueryOptions();

    expect(known.queryKey).toEqual(['users', 'known']);
    expect(known.staleTime).toBe(60_000);
    expect(known.refetchOnReconnect).toBeUndefined();
    expect(known.meta?.persist).toBeUndefined();
    expect(promo.queryKey).toEqual(['users', 'premiumPromo']);
    expect(promo.staleTime).toBe(10 * 60_000);
    expect(promo.meta).toEqual({ persist: false });
    // Read once for the welcome modal: never reloaded by a focus or a reconnect.
    expect(promo.refetchOnWindowFocus).toBe(false);
    expect(promo.refetchOnReconnect).toBe(false);
});

test('loads the known users with exact Money, persisted; the promo counter is never persisted', async () => {
    server.use(
        http.get('*/users/known-users', () =>
            // The literal stays text in the transport: above 2^39 it is exact.
            HttpResponse.text(
                '{"friends":[{"user":{"id":"friend-1","email":"f@example.com","displayName":"F",' +
                    '"createdAt":1,"updatedAt":1},"balances":[{"currency":"USD",' +
                    '"netAmount":899999999999.9997}],"lastUsedCurrency":"USD"}]}',
                { headers: { 'Content-Type': 'application/json' } },
            ),
        ),
        http.get('*/users/premium-promo', () => HttpResponse.json({ premiumPromoRemaining: 417 })),
    );
    const client = new QueryClient();

    const friends = await client.fetchQuery(knownUsersQueryOptions());
    const remaining = await client.fetchQuery(premiumPromoQueryOptions());

    expect(friends[0]?.balances).toEqual([
        { net: fromUnits(8_999_999_999_999_997n, currencyCode('USD')) },
    ]);
    expect(remaining).toBe(417);
    const dehydrated = dehydrate(client, dehydrateOptions);

    expect(dehydrated.queries.map(query => query.queryKey)).toEqual([usersKeys.known()]);
    // The persisted Money survives the codec as a bigint.
    expect(persistCodec.parse(persistCodec.stringify(dehydrated))).toEqual(dehydrated);
});
