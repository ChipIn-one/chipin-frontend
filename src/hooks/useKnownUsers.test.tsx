import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { usersKeys } from 'entities/users';
import { useAuthStore } from 'store/authStore';
import { invalidateKnownUsers } from 'store/internal/usersQueryBridge';
import { createKnownUser } from 'test/knownUsers';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { useKnownUsers } from './useKnownUsers';

const server = setupMswServer();

const wireFriend = {
    user: {
        id: 'friend-1',
        email: 'f@example.com',
        displayName: 'Friend',
        createdAt: 1,
        updatedAt: 1,
    },
    balances: [],
    lastUsedCurrency: null,
};

const serveKnownUsers = (status = 200): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/users/known-users', () => {
            counter.count += 1;
            return status === 200
                ? HttpResponse.json({ friends: [wireFriend] })
                : HttpResponse.json({}, { status });
        }),
    );
    return counter;
};

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

beforeEach(() => {
    useAuthStore.setState({ status: 'unauthenticated', sessionMode: 'online' });
});

afterEach(() => {
    onlineManager.setOnline(true);
});

test('signed out it sends no request and reads nothing, even with friends in the client', async () => {
    const requests = serveKnownUsers();
    mountAsUserClient();
    getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('friend-1')]);

    const { result } = renderHook(() => useKnownUsers());

    await settle();
    expect(requests.count).toBe(0);
    expect(result.current).toMatchObject({ friends: undefined, isLoading: false, isError: false });
});

test('signed in on a client without persistence it sends no request and reads nothing', async () => {
    const requests = serveKnownUsers();
    useAuthStore.setState({ status: 'authenticated' });
    getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('friend-1')]);

    const { result } = renderHook(() => useKnownUsers());

    expect(result.current).toMatchObject({ friends: undefined, isLoading: false, isError: false });
    // A Retry there (DashboardPage) does not reach the server either.
    await act(() => result.current.refetch());
    await settle();
    expect(requests.count).toBe(0);
});

test("a session start loads the friends once on the user's client, with the bridge invalidation", async () => {
    const requests = serveKnownUsers();
    mountAsUserClient();
    useAuthStore.setState({ status: 'unknown' });
    const { result } = renderHook(() => useKnownUsers());

    await settle();
    expect(requests.count).toBe(0);

    // `loadSessionData`: authenticated, then the legacy refresh call site invalidates.
    await act(async () => {
        useAuthStore.setState({ status: 'authenticated' });
        await invalidateKnownUsers('user-1', { joinRunning: true });
    });

    await waitFor(() => {
        expect(result.current.friends?.map(friend => friend.user.id)).toEqual(['friend-1']);
    });
    await settle();
    expect(requests.count).toBe(1);
});

test('an offline-cached session renders the cached friends', () => {
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'offline-cached' });
    getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('friend-1')]);

    const { result } = renderHook(() => useKnownUsers());

    expect(result.current).toMatchObject({ isLoading: false, isError: false });
    expect(result.current.friends).toHaveLength(1);
});

test('a failed first load is an error; a failed refresh with data is not', async () => {
    serveKnownUsers(500);
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated' });

    const { result } = renderHook(() => useKnownUsers());

    await waitFor(() => {
        expect(result.current).toMatchObject({ isError: true, isLoading: false });
    });

    act(() => {
        getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('f')]);
    });
    await waitFor(() => {
        expect(result.current.friends).toHaveLength(1);
    });
    await act(() => result.current.refetch());

    await waitFor(() => {
        expect(result.current).toMatchObject({ isError: false, hasRefreshError: true });
    });
    expect(result.current.friends).toHaveLength(1);
});

test('waiting for the network without data counts as an error; with data it does not', async () => {
    serveKnownUsers();
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated' });
    onlineManager.setOnline(false);

    const { result } = renderHook(() => useKnownUsers());

    await waitFor(() => {
        expect(result.current.isError).toBe(true);
    });

    act(() => {
        getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('f')]);
    });

    await waitFor(() => {
        expect(result.current).toMatchObject({ isError: false, hasRefreshError: false });
    });
    expect(result.current.friends).toHaveLength(1);
});

test.each([
    { sessionMode: 'online', expected: 1 },
    // The legacy reconnect load (`useCheckSignIn`) invalidates it there: one request.
    { sessionMode: 'offline-cached', expected: 0 },
] as const)(
    'a reconnect refetches stale friends only in an $sessionMode session ($expected)',
    async ({ sessionMode, expected }) => {
        const requests = serveKnownUsers();
        mountAsUserClient();
        useAuthStore.setState({ status: 'authenticated', sessionMode });
        // Mounted with fresh data (no load), then the entry turns stale while offline.
        getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('f')]);
        renderHook(() => useKnownUsers());
        await settle();
        onlineManager.setOnline(false);
        getDefaultTestQueryClient().setQueryData(usersKeys.known(), [createKnownUser('f')], {
            updatedAt: Date.now() - 61_000,
        });
        await settle();
        const beforeReconnect = requests.count;

        act(() => {
            onlineManager.setOnline(true);
        });
        await settle();

        expect(requests.count - beforeReconnect).toBe(expected);
    },
);
