import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group as WireGroup } from 'api/chipin.types';
import { invalidateSelfActivity } from 'entities/activity';
import { groupsKeys, groupsMutationKeys } from 'entities/groups';
import {
    getAuthSessionVersion,
    invalidateAuthSession,
    isAuthSessionSwitchedSince,
} from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { ApiError } from 'shared/lib/apiError';
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

vi.mock('entities/activity', async importOriginal => ({
    ...(await importOriginal<typeof import('entities/activity')>()),
    invalidateSelfActivity: vi.fn(() => Promise.resolve()),
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

test('a second update of the same group with the same values joins the running one; another group sends its own', async () => {
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
        duplicate = result.current.update.updateGroup({ groupId: group.id, simplifyDebts: false });
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
        third = update('Second');
    });
    expect(third).toBe(second);

    gates[1]?.resolve();
    await act(() => second);
    expect(bodies).toEqual([{ name: 'First' }, { name: 'Second' }]);
});

// `PATCH /groups/{id}` answering each request with the group named by its body; request `i` waits
// for `gates[i]` and fails with 500 when `failing` has `i`.
const serveChainedPatches = (gates: Deferred[], failing: readonly number[] = []) => {
    const bodies: unknown[] = [];

    server.use(
        http.patch('*/groups/:groupId', async ({ request }) => {
            const body: unknown = await request.json();
            const name =
                typeof body === 'object' && body !== null && 'name' in body ? body.name : undefined;
            const index = bodies.length;

            bodies.push(body);
            await gates[index]?.promise;
            return failing.includes(index)
                ? HttpResponse.json({}, { status: 500 })
                : HttpResponse.json(
                      wireGroup(group.id, { name: typeof name === 'string' ? name : group.name }),
                  );
        }),
        http.get('*/groups', () => HttpResponse.json({ items: [group], nextCursor: null })),
    );
    return bodies;
};

// #893: a second edit with other values while one runs is not lost.
test('an update of the same group with other values waits for the running one, then sends its own', async () => {
    signIn();
    const gates = [deferred(), deferred()];
    const bodies = serveChainedPatches(gates);
    const { result } = renderHook(() => ({
        update: useUpdateGroup(),
        saving: useIsGroupFormSaving(),
    }));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.update.updateGroup({ groupId: group.id, groupName: 'First' });
        second = result.current.update.updateGroup({ groupId: group.id, groupName: 'Second' });
    });

    expect(second).not.toBe(first);
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }]);
    });
    gates[0]?.resolve();
    await expect(first).resolves.toMatchObject({ name: 'First' });
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }, { name: 'Second' }]);
    });
    expect(result.current.update.isPending).toBe(true);
    expect(result.current.saving).toBe(true);
    gates[1]?.resolve();
    await expect(second).resolves.toMatchObject({ name: 'Second' });
    await waitFor(() => {
        expect(result.current.update.isPending).toBe(false);
    });
});

test('an update with the values of an earlier, not last, update of the group is sent after the last one', async () => {
    signIn();
    const gates = [deferred(), deferred(), deferred()];
    const bodies = serveChainedPatches(gates);
    const { result } = renderHook(() => useUpdateGroup());
    const update = (groupName: string): Promise<unknown> =>
        result.current.updateGroup({ groupId: group.id, groupName });

    let calls: Promise<unknown>[] = [];
    act(() => {
        calls = [update('A'), update('B'), update('A')];
    });

    expect(calls[2]).not.toBe(calls[0]);
    for (const gate of gates) {
        gate.resolve();
    }
    await act(() => Promise.all(calls));
    expect(bodies).toEqual([{ name: 'A' }, { name: 'B' }, { name: 'A' }]);
    await expect(calls[1]).resolves.toMatchObject({ name: 'B' });
    await expect(calls[2]).resolves.toMatchObject({ name: 'A' });
});

test('a queued update is still sent after the one before it fails', async () => {
    signIn();
    const gates = [deferred(), deferred()];
    const bodies = serveChainedPatches(gates, [0]);
    const { result } = renderHook(() => useUpdateGroup());

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.updateGroup({ groupId: group.id, groupName: 'First' });
        second = result.current.updateGroup({ groupId: group.id, groupName: 'Second' });
    });
    gates[0]?.resolve();
    gates[1]?.resolve();

    await expect(first).rejects.toBeInstanceOf(ApiError);
    await expect(second).resolves.toMatchObject({ name: 'Second' });
    expect(bodies).toEqual([{ name: 'First' }, { name: 'Second' }]);
});

test('a queued update whose session ended before its turn is refused and sends nothing', async () => {
    signIn();
    const gates = [deferred()];
    const bodies = serveChainedPatches(gates);
    const { result } = renderHook(() => useUpdateGroup());

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.updateGroup({ groupId: group.id, groupName: 'First' });
        second = result.current.updateGroup({ groupId: group.id, groupName: 'Second' });
    });
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }]);
    });
    invalidateAuthSession();
    gates[0]?.resolve();

    await expect(second).rejects.toEqual(new GroupWriteRefusedError('session'));
    await first.catch(() => undefined);
    expect(bodies).toEqual([{ name: 'First' }]);
});

test('a queued update whose turn comes offline is refused and sends nothing', async () => {
    signIn();
    const gates = [deferred()];
    const bodies = serveChainedPatches(gates);
    const { result } = renderHook(() => useUpdateGroup());

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.updateGroup({ groupId: group.id, groupName: 'First' });
        second = result.current.updateGroup({ groupId: group.id, groupName: 'Second' });
    });
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }]);
    });
    onlineManager.setOnline(false);
    gates[0]?.resolve();

    await expect(second).rejects.toEqual(new GroupWriteRefusedError('offline'));
    await first.catch(() => undefined);
    expect(bodies).toEqual([{ name: 'First' }]);
});

test('a queued update of a group removed before its turn is refused and sends nothing', async () => {
    signIn();
    const gates = [deferred()];
    const bodies = serveChainedPatches(gates);
    server.use(http.delete('*/groups/:groupId', () => new HttpResponse(null, { status: 204 })));
    const { result } = renderHook(() => ({ update: useUpdateGroup(), remove: useRemoveGroup() }));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.update.updateGroup({ groupId: group.id, groupName: 'First' });
        second = result.current.update.updateGroup({ groupId: group.id, groupName: 'Second' });
    });
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }]);
    });
    await act(() => result.current.remove.removeGroup(group.id));
    gates[0]?.resolve();

    await expect(second).rejects.toEqual(new GroupWriteRefusedError('session'));
    await first.catch(() => undefined);
    expect(bodies).toEqual([{ name: 'First' }]);
});

test('a queued update is refused when a removal of the group was still running at its call', async () => {
    signIn();
    const gates = [deferred()];
    const removal = deferred();
    const bodies = serveChainedPatches(gates);
    server.use(
        http.delete('*/groups/:groupId', async () => {
            await removal.promise;
            return new HttpResponse(null, { status: 204 });
        }),
    );
    const { result } = renderHook(() => ({ update: useUpdateGroup(), remove: useRemoveGroup() }));

    let first: Promise<unknown> = Promise.resolve();
    let removed: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.update.updateGroup({ groupId: group.id, groupName: 'First' });
        removed = result.current.remove.removeGroup(group.id);
    });
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        second = result.current.update.updateGroup({ groupId: group.id, groupName: 'Second' });
    });
    removal.resolve();
    await act(() => removed);
    gates[0]?.resolve();

    await expect(second).rejects.toEqual(new GroupWriteRefusedError('session'));
    await first.catch(() => undefined);
    expect(bodies).toEqual([{ name: 'First' }]);
});

test('a queued update is sent after its component unmounted, and its pending state shows', async () => {
    const client = signIn();
    client.setMutationDefaults(groupsMutationKeys.update, { gcTime: 0 });
    const gates = [deferred(), deferred()];
    const bodies = serveChainedPatches(gates);
    const { result, unmount } = renderHook(() => useUpdateGroup());
    const saving = renderHook(() => useIsGroupFormSaving());

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
        first = result.current.updateGroup({ groupId: group.id, groupName: 'First' });
        second = result.current.updateGroup({ groupId: group.id, groupName: 'Second' });
    });
    unmount();
    gates[0]?.resolve();
    await act(() => first);
    await waitFor(() => {
        expect(bodies).toEqual([{ name: 'First' }, { name: 'Second' }]);
    });
    expect(saving.result.current).toBe(true);
    gates[1]?.resolve();

    await expect(second).resolves.toMatchObject({ name: 'Second' });
    // Nothing holds the settled writes: the cache collects them.
    await waitFor(() => {
        expect(
            client.getMutationCache().findAll({ mutationKey: groupsMutationKeys.update }),
        ).toEqual([]);
    });
});

test("a removed group resets the last-group default and marks the user's activity feeds stale on its client", async () => {
    const client = signIn();
    server.use(
        http.delete('*/groups/:groupId', () => new HttpResponse(null, { status: 204 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    useUiPrefsStore.getState().setLastGroupId(group.id);
    const { result } = renderHook(() => useRemoveGroup());

    await act(() => result.current.removeGroup(group.id));

    expect(useUiPrefsStore.getState().lastGroupId).toBeNull();
    expect(invalidateSelfActivity).toHaveBeenCalledWith(client);
});

test('leaving another group keeps the last-group default', async () => {
    const client = signIn();
    server.use(
        http.post('*/groups/:groupId/leave', () => new HttpResponse(null, { status: 204 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    useUiPrefsStore.getState().setLastGroupId('group-2');
    const { result } = renderHook(() => useLeaveGroup());

    await act(() => result.current.leaveGroup({ groupId: group.id }));

    expect(useUiPrefsStore.getState().lastGroupId).toBe('group-2');
    expect(invalidateSelfActivity).toHaveBeenCalledWith(client);
});

test("a kick shows its pending state and marks the user's activity feeds stale on its client", async () => {
    const client = signIn();
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

    expect(invalidateSelfActivity).toHaveBeenCalledWith(client);
    await waitFor(() => {
        expect(result.current.isPending).toBe(false);
    });
});

// Another tab switched the account: this tab's token refresh returns the other user's token. The
// auth session version moves as a switch, not a session end, and the previous user's data and client
// go (spec 03 §1.5, #641).
const switchAccountInAnotherTab = (): void => {
    const sessionVersion = getAuthSessionVersion();

    act(() => {
        onAccessTokenRefreshed(fakeAccessToken('user-2'));
    });
    expect(getAuthSessionVersion()).toBe(sessionVersion + 1);
    expect(isAuthSessionSwitchedSince(sessionVersion)).toBe(true);
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

    expect(invalidateSelfActivity).not.toHaveBeenCalled();
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

    expect(invalidateSelfActivity).not.toHaveBeenCalled();
});
