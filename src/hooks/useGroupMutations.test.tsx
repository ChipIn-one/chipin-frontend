import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group as WireGroup } from 'api/chipin.types';
import { groupsKeys } from 'entities/groups';
import { clearLocalUserIdentity } from 'helpers/localStorage';
import { useActivityStore } from 'store/activity-store';
import { useAuthStore } from 'store/authStore';
import { useUiPrefsStore } from 'store/ui-prefs';
import { wireGroup } from 'test/groupFixtures';
import { groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    GroupWriteRefusedError,
    useCreateGroup,
    useIsGroupFormSaving,
    useKickGroupMember,
    useLeaveGroup,
    useRemoveGroup,
    useUpdateGroup,
} from './useGroupMutations';

const server = setupMswServer();

interface Deferred {
    promise: Promise<void>;
    resolve: () => void;
}

const deferred = (): Deferred => {
    let resolve = (): void => undefined;
    const promise = new Promise<void>(done => {
        resolve = done;
    });

    return { promise, resolve };
};

const group = wireGroup('group-1');

const fetchSetActivity = vi.fn(() => Promise.resolve());

const signIn = () => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    const client = mountAsUserClient();

    client.setQueryData(groupsKeys.list(), groupsListData([]));
    return client;
};

// `PATCH /groups/{id}` answering the group renamed by the body, held by `gate`.
const servePatch = (gate?: Deferred) => {
    const bodies: unknown[] = [];

    server.use(
        http.patch('*/groups/:groupId', async ({ request }) => {
            const body: unknown = await request.json();

            bodies.push(body);
            await gate?.promise;
            return HttpResponse.json(group);
        }),
        http.get('*/groups', () => HttpResponse.json({ items: [group], nextCursor: null })),
    );
    return bodies;
};

beforeEach(() => {
    vi.clearAllMocks();
    useActivityStore.setState({ fetchSetActivity });
    useUiPrefsStore.getState().resetUiPrefs();
});

afterEach(() => {
    onlineManager.setOnline(true);
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

test('a group write while signed out is refused before any request', async () => {
    const requests = vi.fn();
    server.use(
        http.post('*/groups', () => {
            requests();
            return HttpResponse.json(group);
        }),
    );
    const { result } = renderHook(() => useCreateGroup());

    await expect(result.current.createGroup({ groupName: 'Trip' })).rejects.toEqual(
        new GroupWriteRefusedError('session'),
    );
    expect(requests).not.toHaveBeenCalled();
});

test('a group write offline is refused: no request, nothing waits for a reconnect', async () => {
    signIn();
    const bodies = servePatch();
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useUpdateGroup());

    const refusal = result.current.updateGroup({ groupId: group.id, groupName: 'Renamed' });

    await expect(refusal).rejects.toEqual(new GroupWriteRefusedError('offline'));
    expect(result.current.isPending).toBe(false);
    onlineManager.setOnline(true);
    expect(bodies).toEqual([]);
});

test('a second update of the same group joins the running one; another group sends its own', async () => {
    signIn();
    const gate = deferred();
    const bodies = servePatch(gate);
    const { result } = renderHook(() => ({
        update: useUpdateGroup(),
        saving: useIsGroupFormSaving(),
    }));

    let first: Promise<unknown> = Promise.resolve();
    let duplicate: Promise<unknown> = Promise.resolve();
    let other: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.update.updateGroup({ groupId: group.id, simplifyDebts: false });
        duplicate = result.current.update.updateGroup({ groupId: group.id, simplifyDebts: true });
        other = result.current.update.updateGroup({ groupId: 'group-2', groupName: 'Other' });
    });

    expect(duplicate).toBe(first);
    expect(other).not.toBe(first);
    await waitFor(() => {
        expect(bodies).toEqual([{ simplifyDebts: false }, { name: 'Other' }]);
    });
    expect(result.current.update.isPending).toBe(true);
    expect(result.current.saving).toBe(true);
    gate.resolve();
    await act(() => Promise.all([first, other]));

    await waitFor(() => {
        expect(result.current.update.isPending).toBe(false);
    });
    expect(result.current.saving).toBe(false);
});

test('a removed group resets the last-group default and refreshes the activity store', async () => {
    signIn();
    server.use(
        http.delete('*/groups/:groupId', () => new HttpResponse(null, { status: 204 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    useUiPrefsStore.getState().setLastGroupId(group.id);
    const { result } = renderHook(() => useRemoveGroup());

    await act(() => result.current.removeGroup(group.id));

    expect(useUiPrefsStore.getState().lastGroupId).toBeNull();
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
});

test('leaving another group keeps the last-group default', async () => {
    signIn();
    server.use(
        http.post('*/groups/:groupId/leave', () => new HttpResponse(null, { status: 204 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    useUiPrefsStore.getState().setLastGroupId('group-2');
    const { result } = renderHook(() => useLeaveGroup());

    await act(() => result.current.leaveGroup({ groupId: group.id }));

    expect(useUiPrefsStore.getState().lastGroupId).toBe('group-2');
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
});

test('a kick shows its pending state and refreshes the activity store', async () => {
    signIn();
    const gate = deferred();
    server.use(
        http.post('*/groups/:groupId/members/:userId/kick', async () => {
            await gate.promise;
            return new HttpResponse(null, { status: 204 });
        }),
        http.get('*/groups/:groupId', () => HttpResponse.json(group satisfies WireGroup)),
    );
    const { result } = renderHook(() => useKickGroupMember());

    let done: Promise<void> = Promise.resolve();
    act(() => {
        done = result.current.kickGroupMember({ groupId: group.id, userId: 'user-2' });
    });
    await waitFor(() => {
        expect(result.current.isPending).toBe(true);
    });
    gate.resolve();
    await act(() => done);

    expect(fetchSetActivity).toHaveBeenCalledWith(true);
    await waitFor(() => {
        expect(result.current.isPending).toBe(false);
    });
});
