import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group as WireGroup } from 'api/chipin.types';
import { groupsKeys } from 'entities/groups';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { ApiError } from 'shared/lib/apiError';
import { useActivityStore } from 'store/activity-store';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { useUiPrefsStore } from 'store/ui-prefs';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
import { groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    GroupWriteRefusedError,
    toastGroupWriteError,
    useCreateGroup,
    useIsGroupFormSaving,
    useKickGroupMember,
    useLeaveGroup,
    useRemoveGroup,
    useUpdateGroup,
} from './useGroupMutations';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('i18next', () => ({
    default: { t: (key: string) => key },
}));

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
    const client = signIn();
    const bodies = servePatch();
    const waitingWrites = () =>
        client
            .getMutationCache()
            .getAll()
            .filter(mutation => mutation.state.status === 'pending' || mutation.state.isPaused);
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useUpdateGroup());

    const refusal = result.current.updateGroup({ groupId: group.id, groupName: 'Renamed' });

    await expect(refusal).rejects.toEqual(new GroupWriteRefusedError('offline'));
    expect(result.current.isPending).toBe(false);
    expect(waitingWrites()).toEqual([]);
    act(() => {
        onlineManager.setOnline(true);
    });
    // Long enough for a resumed mutation to reach the server.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(waitingWrites()).toEqual([]);
    expect(bodies).toEqual([]);
});

test('a refused group write shows the offline message, and nothing for an ended session', () => {
    toastGroupWriteError(new GroupWriteRefusedError('session'), 'fallback');
    expect(toast.error).not.toHaveBeenCalled();

    toastGroupWriteError(new GroupWriteRefusedError('offline'), 'fallback');
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenLastCalledWith('errors:network.offline');
});

test('a failed group write shows the fallback message without a backend one', () => {
    toastGroupWriteError(new Error('Network Error'), 'fallback');
    toastGroupWriteError(
        new ApiError({ status: 500, payload: undefined, cause: undefined }),
        'other fallback',
    );

    expect(toast.error).toHaveBeenNthCalledWith(1, 'fallback');
    expect(toast.error).toHaveBeenNthCalledWith(2, 'other fallback');
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

test('an update after the session changed sends its own request and stays the running one', async () => {
    signIn();
    const gates = [deferred(), deferred()];
    const bodies: unknown[] = [];
    server.use(
        http.patch('*/groups/:groupId', async ({ request }) => {
            const body: unknown = await request.json();
            const gate = gates[bodies.length];

            bodies.push(body);
            await gate?.promise;
            return HttpResponse.json(group);
        }),
        http.get('*/groups', () => HttpResponse.json({ items: [group], nextCursor: null })),
    );
    const { result } = renderHook(() => useUpdateGroup());
    const update = (groupName: string): Promise<unknown> =>
        result.current.updateGroup({ groupId: group.id, groupName });

    let first: Promise<unknown> = Promise.resolve();
    act(() => {
        first = update('First');
    });
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }]);
    });
    const firstSession = getAuthSessionVersion();
    invalidateAuthSession();
    expect(getAuthSessionVersion()).not.toBe(firstSession);

    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        second = update('Second');
    });
    expect(second).not.toBe(first);
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }, { name: 'Second' }]);
    });

    // The old request settles: its cleanup leaves the newer running update in place.
    gates[0]?.resolve();
    await act(() => first);
    let third: Promise<unknown> = Promise.resolve();
    act(() => {
        third = update('Third');
    });
    expect(third).toBe(second);

    gates[1]?.resolve();
    await act(() => second);
    expect(bodies).toEqual([{ name: 'First' }, { name: 'Second' }]);
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

// Another tab switched the account: this tab's token refresh returns the other user's token. The
// auth session version stays, the previous user's data and client go (spec 03 §1.5).
const switchAccountInAnotherTab = (): void => {
    const sessionVersion = getAuthSessionVersion();

    act(() => {
        onAccessTokenRefreshed(fakeAccessToken('user-2'));
    });
    expect(getAuthSessionVersion()).toBe(sessionVersion);
};

const signInAsCachedUser = () => {
    saveLocalUser({
        id: 'user-1',
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
    });
    return signIn();
};

// The data of the next user, which the switch loads: none of it matters here.
const serveNextUserLoads = (): void => {
    server.use(
        http.get('*/users/*', () => HttpResponse.json({}, { status: 500 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
};

test('a kick answered after another tab switched the account runs nothing in the new session', async () => {
    signInAsCachedUser();
    serveNextUserLoads();
    const gate = deferred();
    const detailReads = vi.fn();
    server.use(
        http.post('*/groups/:groupId/members/:userId/kick', async () => {
            await gate.promise;
            return new HttpResponse(null, { status: 204 });
        }),
        http.get('*/groups/:groupId', () => {
            detailReads();
            return HttpResponse.json(group satisfies WireGroup);
        }),
    );
    const { result } = renderHook(() => useKickGroupMember());

    let done: Promise<void> = Promise.resolve();
    act(() => {
        done = result.current.kickGroupMember({ groupId: group.id, userId: 'user-3' });
    });
    await waitFor(() => {
        expect(result.current.isPending).toBe(true);
    });
    switchAccountInAnotherTab();
    gate.resolve();
    await act(() => done);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fetchSetActivity).not.toHaveBeenCalled();
    expect(detailReads).not.toHaveBeenCalled();
});

test('a removal answered after another tab switched the account runs nothing in the new session', async () => {
    signInAsCachedUser();
    serveNextUserLoads();
    const gate = deferred();
    const removals = vi.fn();
    server.use(
        http.delete('*/groups/:groupId', async () => {
            removals();
            await gate.promise;
            return new HttpResponse(null, { status: 204 });
        }),
    );
    const { result } = renderHook(() => useRemoveGroup());

    let done: Promise<void> = Promise.resolve();
    act(() => {
        done = result.current.removeGroup(group.id);
    });
    await waitFor(() => {
        expect(removals).toHaveBeenCalledOnce();
    });
    switchAccountInAnotherTab();
    gate.resolve();
    await act(() => done);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fetchSetActivity).not.toHaveBeenCalled();
});
