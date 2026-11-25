// #719: `initializeApi` wires the restored self user to the cached language and theme.
import { dehydrate, QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { apiInstance, publicApiInstance } from 'api/chipin.instance';
import { AuthRequestCancelledError } from 'api/chipin.interceptors';
import type { UserSettings } from 'api/chipin.types';
import { resetUpdateRequiredForTests, useIsUpdateRequired } from 'app/pwa/updateRequired';
import { reconcileRestoredSelf, type SelfUser, usersKeys } from 'entities/users';
import {
    establishAuthSession,
    getFreshAccessToken,
    invalidateAuthSession,
    setAccessTokenRefreshListener,
} from 'helpers/authSession';
import { getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';
import { queryCacheKey } from 'shared/offline/constants';
import { outboxGate } from 'shared/offline/outboxGate';
import { persistCodec } from 'shared/offline/persistCodec';
import { QUERY_CACHE_BUSTER } from 'shared/offline/queryPersister';
import { bootstrapUserCache, clientFor, RESTORE_TIMEOUT_MS } from 'shared/offline/restore';
import { setCacheRestoredHandler } from 'shared/offline/userCaches';
import { useAuthStore } from 'store/authStore';

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

describe('03-20 / API-002: a 426 CLIENT.OUTDATED reaches the "Update required" state', () => {
    const outdatedRequest = () =>
        publicApiInstance.get('/public', {
            adapter: config =>
                Promise.reject({
                    config,
                    isAxiosError: true,
                    response: {
                        config,
                        data: { code: 'CLIENT.OUTDATED' },
                        headers: {},
                        status: 426,
                    },
                }),
        });

    afterEach(() => {
        outboxGate.reset();
        resetUpdateRequiredForTests();
    });

    test('it closes the outbox gate outdated and shows the screen', async () => {
        const { result } = renderHook(() => useIsUpdateRequired());

        await expect(outdatedRequest()).rejects.toMatchObject({ response: { status: 426 } });

        expect(outboxGate.isClosed('outdated')).toBe(true);
        expect(result.current).toBe(true);
    });

    test('03-20 / API-005: with no backend minimum (no header, no 426) nothing is shown', async () => {
        const { result } = renderHook(() => useIsUpdateRequired());

        await publicApiInstance.get('/public', {
            adapter: config =>
                Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: 'OK' }),
        });

        expect(outboxGate.isClosed('outdated')).toBe(false);
        expect(result.current).toBe(false);
    });
});

// Spec 03 §1.5 (#641), as the app wires it: the refresh listener `onAccessTokenRefreshed` and the
// unauthorized callback `expireSession`. Another tab signed Y in; X's request gets a 401, its retry
// refresh returns Y's token.
describe('§1.5 refresh switch through the app wiring', () => {
    const accessToken = (userId: string): string =>
        `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3_600, sub: userId }))}.signature`;
    type ApiRequestConfig = Parameters<
        NonNullable<Parameters<typeof apiInstance.interceptors.request.use>[0]>
    >[0];
    const response = (config: ApiRequestConfig, status: number, data: unknown) => ({
        config,
        data,
        headers: {},
        status,
        statusText: '',
    });
    const defaultAdapter = apiInstance.defaults.adapter;

    afterEach(() => {
        apiInstance.defaults.adapter = defaultAdapter;
        setAccessTokenRefreshListener(null);
        invalidateAuthSession();
    });

    test('the X request is cancelled as stale, Y is not expired, LocalUser is Y', async () => {
        const tokenOfX = accessToken('user-x');
        const tokenOfY = accessToken('user-y');

        saveLocalUser({ id: 'user-x', role: 'USER', settings });
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
        establishAuthSession(tokenOfX);
        apiInstance.defaults.adapter = config => {
            if (config.url === '/auth/refresh') {
                return Promise.resolve(response(config, 200, { token: tokenOfY }));
            }
            return config.headers.Authorization === `Bearer ${tokenOfX}`
                ? Promise.reject({
                      config,
                      isAxiosError: true,
                      response: response(config, 401, { code: 'AUTH.UNAUTHORIZED' }),
                  })
                : Promise.resolve(response(config, 200, {}));
        };

        const error: unknown = await apiInstance.get('/dashboard').then(
            () => null,
            (rejection: unknown) => rejection,
        );

        expect(error).toBeInstanceOf(AuthRequestCancelledError);
        expect(error).toMatchObject({ isStaleSession: true });
        expect(useAuthStore.getState().unauthReason).toBeUndefined();
        expect(getLocalUser()?.id).toBe('user-y');
        expect(await getFreshAccessToken()).toBe(tokenOfY);
    });
});
