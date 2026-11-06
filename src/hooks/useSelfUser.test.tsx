import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { type SelfUser, userLanguage, usersKeys } from 'entities/users';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';

import { useIsUserAdmin, useSelfUser, useUserSetting } from './useSelfUser';

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

beforeEach(() => {
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

test('signed in it waits while the users store loads the self user, then loads it once', async () => {
    const requests = countSelfRequests();
    useAuthStore.setState({ status: 'authenticated' });
    useLoadingStore.getState().setLoading('users', 'self', 'loading');

    const { result } = renderHook(() => useSelfUser());

    await Promise.resolve();
    expect(requests.count).toBe(0);

    act(() => {
        useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    });

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
