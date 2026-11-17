// #719: `initializeApi` wires the restored self user to the cached language and theme.
import { dehydrate, QueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { reconcileRestoredSelf, type SelfUser, usersKeys } from 'entities/users';
import { saveLocalUser } from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';
import { queryCacheKey } from 'shared/offline/constants';
import { persistCodec } from 'shared/offline/persistCodec';
import { QUERY_CACHE_BUSTER } from 'shared/offline/queryPersister';
import { bootstrapUserCache, clientFor, RESTORE_TIMEOUT_MS } from 'shared/offline/restore';
import { setCacheRestoredHandler } from 'shared/offline/userCaches';

import { initializeApi } from './initializeApi';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, get: vi.fn(actual.get) };
});
vi.mock('entities/users', async importOriginal => {
    const actual = await importOriginal<typeof import('entities/users')>();

    return { ...actual, reconcileRestoredSelf: vi.fn(actual.reconcileRestoredSelf) };
});

const RESTORED_AT = Date.now() - 60_000;

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

const selfUser = (id: string): SelfUser => ({
    id,
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings,
    createdAt: 1,
    updatedAt: 1,
});

/** The persisted cache of `userId` with its self user in English and light, and the newer cached user. */
const storeStaleSelf = (userId: string): Promise<string> => {
    const source = new QueryClient();
    source.setQueryData(usersKeys.self(), selfUser(userId), { updatedAt: RESTORED_AT });
    const text = persistCodec.stringify({
        timestamp: Date.now(),
        buster: QUERY_CACHE_BUSTER,
        clientState: dehydrate(source),
    });

    saveLocalUser({
        id: userId,
        role: 'USER',
        settings: { ...settings, language: 'ru', theme: 'dark' },
    });
    return set(queryCacheKey(userId), text).then(() => text);
};

/** The next IDB read waits until `release` is called. */
const holdNextRead = (): { release: (value: string) => void } => {
    const pending: { release: (value: string) => void } = { release: () => undefined };

    vi.mocked(get).mockImplementationOnce(
        () =>
            new Promise(resolve => {
                pending.release = resolve;
            }),
    );
    return pending;
};

beforeEach(() => {
    vi.mocked(reconcileRestoredSelf).mockClear();
    initializeApi();
});

afterEach(() => {
    setCacheRestoredHandler(null);
    vi.useRealTimers();
});

test('the restored self user takes the cached language and theme, with its update time', async () => {
    await storeStaleSelf('wired');

    await bootstrapUserCache('wired');

    const client = clientFor('wired');
    expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings).toEqual({
        ...settings,
        language: 'ru',
        theme: 'dark',
    });
    expect(client.getQueryState(usersKeys.self())?.dataUpdatedAt).toBe(RESTORED_AT);
});

test('a timed-out restore does not run the handler', async () => {
    const text = await storeStaleSelf('timed-out');
    const read = holdNextRead();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const ready = bootstrapUserCache('timed-out');
    await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS);
    await ready;
    vi.useRealTimers();
    read.release(text);
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(reconcileRestoredSelf).not.toHaveBeenCalled();
    expect(clientFor('timed-out').getQueryData(usersKeys.self())).toBeUndefined();
});

test('a restore whose user data was cleared meanwhile does not run the handler', async () => {
    const text = await storeStaleSelf('disposed');
    const read = holdNextRead();

    const ready = bootstrapUserCache('disposed');
    await clearUserData('disposed', () => undefined);
    read.release(text);
    await ready;

    expect(reconcileRestoredSelf).not.toHaveBeenCalled();
});
