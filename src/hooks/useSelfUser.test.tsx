import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { type SelfUser, userLanguage, usersKeys } from 'entities/users';
import { clearLocalUserIdentity, getTabUserId, saveLocalUser } from 'helpers/localStorage';
import { cachesByUser, takePendingSeed } from 'shared/offline/userCaches';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { loadSelfUserForSession, resetSessionSelfLoad } from 'store/sessionUser';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';

import { useIsUserAdmin, useSelfUser, useSelfUserState, useUserSetting } from './useSelfUser';

const server = setupMswServer();

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'ru',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

const selfUser: SelfUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'ADMIN',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: { ...settings, language: 'en' },
    createdAt: 1,
    updatedAt: 1,
};

const countSelfRequests = (): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/users/self', () => {
            counter.count += 1;
            return HttpResponse.json({ ...selfUser, isPremium: false });
        }),
    );
    return counter;
};

// The test client as the signed-in user's persisted client (`clientFor` registers it).
const mountAsUserClient = () => {
    cachesByUser.set('user-1', {
        client: getDefaultTestQueryClient(),
        ready: Promise.resolve(),
        isReady: true,
        listeners: new Set(),
        unsubscribe: null,
        disposed: false,
    });
};

afterEach(() => {
    cachesByUser.delete('user-1');
});

beforeEach(() => {
    resetSessionSelfLoad();
    clearLocalUserIdentity();
    saveLocalUser({ id: 'user-1', role: 'USER', settings });
    useLoadingStore.getState().setInitialLoadingStore();
    useAuthStore.setState({ status: 'unauthenticated', sessionMode: 'online' });
});

test('signed out it sends no request and reads settings and role from the cached user', () => {
    const requests = countSelfRequests();

    const { result } = renderHook(() => ({
        user: useSelfUser(),
        language: useUserSetting(userLanguage),
        isAdmin: useIsUserAdmin(),
    }));

    expect(result.current).toEqual({ user: null, language: 'ru', isAdmin: false });
    return Promise.resolve().then(() => {
        expect(requests.count).toBe(0);
    });
});

test('signed in on the user client it loads the self user once', async () => {
    const requests = countSelfRequests();
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated' });

    const { result } = renderHook(() => useSelfUser());

    await waitFor(() => {
        expect(result.current?.id).toBe('user-1');
    });
    expect(requests.count).toBe(1);
});

test('a seeded user is read without a request, over the cached user', async () => {
    const requests = countSelfRequests();
    useAuthStore.setState({ status: 'authenticated' });
    getDefaultTestQueryClient().setQueryData(usersKeys.self(), selfUser);

    const { result } = renderHook(() => ({
        language: useUserSetting(userLanguage),
        isAdmin: useIsUserAdmin(),
    }));

    expect(result.current).toEqual({ language: 'en', isAdmin: true });
    await Promise.resolve();
    expect(requests.count).toBe(0);
});

test('an offline-cached session renders the cached self user', () => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'offline-cached' });
    getDefaultTestQueryClient().setQueryData(usersKeys.self(), selfUser);

    const { result } = renderHook(() => useSelfUser());

    expect(result.current).toEqual(selfUser);
});

// A signed-in visitor on a public page runs on the anonymous client: the session loader's own
// load is the only request, the readers take the cached user it writes.
test('on a client without persistence the session load is the only self request', async () => {
    const requests = countSelfRequests();
    useAuthStore.setState({ status: 'authenticated' });

    const { result, rerender } = renderHook(() => useUserSetting(userLanguage));

    await act(() => loadSelfUserForSession());
    await new Promise(resolve => setTimeout(resolve, 10));
    rerender();

    expect(requests.count).toBe(1);
    // The loader wrote the cached user, which this reader falls back to.
    expect(result.current).toBe('en');
    // The user's client is never created here: drop what waits for it.
    takePendingSeed('user-1');
});

test('signed out it reads the cached user even when the client still holds a self user', () => {
    getDefaultTestQueryClient().setQueryData(usersKeys.self(), selfUser);

    const { result } = renderHook(() => ({
        language: useUserSetting(userLanguage),
        isAdmin: useIsUserAdmin(),
    }));

    expect(result.current).toEqual({ language: 'ru', isAdmin: false });
});

describe('useSelfUserState', () => {
    test('signed in on the anonymous client (before the remount): loading, no request', async () => {
        const requests = countSelfRequests();
        useAuthStore.setState({ status: 'authenticated' });

        const { result } = renderHook(() => useSelfUserState());

        expect(result.current).toMatchObject({ user: null, isLoading: true, isFetched: false });
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(requests.count).toBe(0);
    });

    test('a failed first sign-in settles with an error; Retry loads the user once and writes its id', async () => {
        // A first sign-in: no cached id, so the app stays on the anonymous client.
        clearLocalUserIdentity();
        server.use(http.get('*/users/self', () => HttpResponse.json({}, { status: 500 })));
        useAuthStore.setState({ status: 'authenticated' });
        const { result } = renderHook(() => useSelfUserState());

        await act(() => loadSelfUserForSession());

        expect(result.current).toMatchObject({
            user: null,
            isLoading: false,
            isFetched: true,
            isError: true,
        });
        expect(getTabUserId()).toBeUndefined();

        const requests = countSelfRequests();
        await act(() => result.current.refetch());

        expect(requests.count).toBe(1);
        // The id written: the app remounts onto the user's client.
        expect(getTabUserId()).toBe('user-1');
        expect(result.current.isError).toBe(false);
        takePendingSeed('user-1');
    });

    test('signed out Retry sends nothing', async () => {
        const requests = countSelfRequests();
        const { result } = renderHook(() => useSelfUserState());

        await result.current.refetch();

        expect(requests.count).toBe(0);
    });

    test('a cached user is fetched at once', () => {
        mountAsUserClient();
        useAuthStore.setState({ status: 'authenticated' });
        getDefaultTestQueryClient().setQueryData(usersKeys.self(), selfUser);

        const { result } = renderHook(() => useSelfUserState());

        expect(result.current).toMatchObject({
            user: selfUser,
            isLoading: false,
            isFetched: true,
            isError: false,
        });
    });

    test('a failed first load is settled with an error', async () => {
        server.use(http.get('*/users/self', () => HttpResponse.json({}, { status: 500 })));
        mountAsUserClient();
        useAuthStore.setState({ status: 'authenticated' });

        const { result } = renderHook(() => useSelfUserState());

        expect(result.current.isLoading).toBe(true);
        await waitFor(() => {
            expect(result.current).toMatchObject({ isFetched: true, isError: true });
        });
        expect(result.current.isLoading).toBe(false);
    });

    test('an offline-cached session without a cached user never waits for the network', async () => {
        const requests = countSelfRequests();
        onlineManager.setOnline(false);
        mountAsUserClient();
        useAuthStore.setState({ status: 'authenticated', sessionMode: 'offline-cached' });

        const { result } = renderHook(() => useSelfUserState());

        await waitFor(() => {
            expect(result.current).toMatchObject({ isFetched: true, isLoading: false });
        });
        expect(requests.count).toBe(0);
        onlineManager.setOnline(true);
    });

    test('signed out nothing is loading', () => {
        const { result } = renderHook(() => useSelfUserState());

        expect(result.current).toMatchObject({ user: null, isLoading: false, isFetched: false });
    });
});
