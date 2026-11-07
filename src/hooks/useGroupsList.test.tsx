import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';
import { groupsKeys } from 'entities/groups';
import { saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { loadGroupsListForSession } from 'store/groupsList';
import { groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { useGroups, useGroupsList } from './useGroupsList';

const server = setupMswServer();

const group = (id: string) => ({ id, name: `Group ${id}` }) as unknown as Group;

const serveGroups = (status = 200): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/groups', () => {
            counter.count += 1;
            return status === 200
                ? HttpResponse.json({ items: [group('a')], nextCursor: null })
                : HttpResponse.json({}, { status });
        }),
    );
    return counter;
};

const SETTINGS = {
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
} as const;

const seed = (groups: Group[]) => {
    getDefaultTestQueryClient().setQueryData(groupsKeys.list(), groupsListData(groups));
};

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

beforeEach(() => {
    useAuthStore.setState({ status: 'unauthenticated', sessionMode: 'online' });
});

afterEach(() => {
    onlineManager.setOnline(true);
});

test('signed out it sends no request and reads nothing, even with groups in the client', async () => {
    const requests = serveGroups();
    mountAsUserClient();
    seed([group('a')]);

    const { result } = renderHook(() => useGroupsList());

    await act(() => result.current.refetch());
    await settle();
    expect(requests.count).toBe(0);
    expect(result.current).toMatchObject({ groups: undefined, isLoading: false, isError: false });
});

test('signed in on a client without persistence it sends no request and reads nothing', async () => {
    const requests = serveGroups();
    useAuthStore.setState({ status: 'authenticated' });
    seed([group('a')]);

    const { result } = renderHook(() => useGroupsList());

    // Before the remount onto the user's client the groups are still to come.
    expect(result.current).toMatchObject({ groups: undefined, isLoading: true, isError: false });
    await act(() => result.current.refetch());
    await settle();
    expect(requests.count).toBe(0);
});

test("a session start loads the groups once on the user's client", async () => {
    const requests = serveGroups();
    saveLocalUser({ id: 'user-1', settings: SETTINGS });
    mountAsUserClient();
    useAuthStore.setState({ status: 'unknown' });
    const { result } = renderHook(() => useGroups());

    await settle();
    expect(requests.count).toBe(0);
    expect(result.current).toEqual([]);

    await act(async () => {
        const since = Date.now();
        useAuthStore.setState({ status: 'authenticated' });
        await loadGroupsListForSession(since);
    });

    await waitFor(() => {
        expect(result.current).toEqual([group('a')]);
    });
    await settle();
    expect(requests.count).toBe(1);
});

test('an offline-cached session renders the cached groups', () => {
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'offline-cached' });
    seed([group('a')]);

    const { result } = renderHook(() => useGroupsList());

    expect(result.current).toMatchObject({ isLoading: false, isError: false });
    expect(result.current.groups).toEqual([group('a')]);
});

test('a failed first load is an error; a failed refresh with data is not', async () => {
    serveGroups(500);
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated' });

    const { result } = renderHook(() => useGroupsList());

    await waitFor(() => {
        expect(result.current).toMatchObject({ isError: true, isLoading: false });
    });

    act(() => {
        seed([group('a')]);
    });
    await waitFor(() => {
        expect(result.current.groups).toHaveLength(1);
    });
    await act(() => result.current.refetch());

    await waitFor(() => {
        expect(result.current).toMatchObject({ isError: false, hasRefreshError: true });
    });
    expect(result.current.groups).toHaveLength(1);
});

test('waiting for the network without data counts as an error; with data it does not', async () => {
    serveGroups();
    mountAsUserClient();
    useAuthStore.setState({ status: 'authenticated' });
    onlineManager.setOnline(false);

    const { result } = renderHook(() => useGroupsList());

    await waitFor(() => {
        expect(result.current.isError).toBe(true);
    });

    act(() => {
        seed([group('a')]);
    });

    await waitFor(() => {
        expect(result.current).toMatchObject({ isError: false, hasRefreshError: false });
    });
    expect(result.current.groups).toHaveLength(1);
});
