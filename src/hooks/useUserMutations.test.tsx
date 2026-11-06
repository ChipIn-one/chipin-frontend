import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { type KnownUser, type SelfUser, usersKeys } from 'entities/users';
import { invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { createKnownUser } from 'test/knownUsers';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import {
    useAcceptFriendInvite,
    useExtendSubscriptionByDay,
    useRemoveKnownUser,
    UserWriteRefusedError,
    useUpdateSelf,
    useUploadAvatar,
} from './useUserMutations';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('i18next', () => ({
    default: { t: (key: string) => key, exists: () => false },
}));

const server = setupMswServer();

const selfUser: SelfUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'light',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
};

const toWire = (user: SelfUser) => ({ ...user, isPremium: false });

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

/** PATCH /users/self answering with the user changed by the body; each call can be held. */
const servePatch = (gates: Deferred[] = []) => {
    const bodies: unknown[] = [];
    let serverUser = selfUser;

    server.use(
        http.patch('*/users/self', async ({ request }) => {
            const body = (await request.json()) as {
                displayName?: string;
                settings?: Partial<SelfUser['settings']>;
            };
            const gate = gates[bodies.length];

            bodies.push(body);
            await gate?.promise;
            serverUser = {
                ...serverUser,
                ...(body.displayName !== undefined && { displayName: body.displayName }),
                settings: { ...serverUser.settings, ...body.settings },
            };
            return HttpResponse.json(toWire(serverUser));
        }),
    );
    return bodies;
};

const selfInCache = (): SelfUser | undefined =>
    getDefaultTestQueryClient().getQueryData<SelfUser>(usersKeys.self());

const signInWithCachedSelf = () => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    saveLocalUser({ id: selfUser.id, role: selfUser.role, settings: selfUser.settings });
    const client = mountAsUserClient();

    client.setQueryData(usersKeys.self(), selfUser);
    return client;
};

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    onlineManager.setOnline(true);
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

test('updateSelf sends only the changes, shows them at once and keeps the response', async () => {
    signInWithCachedSelf();
    const gate = deferred();
    const bodies = servePatch([gate]);
    const { result } = renderHook(() => useUpdateSelf());

    let done: Promise<void> = Promise.resolve();
    act(() => {
        done = result.current.updateSelf({ settings: { timeFormat: '24h' } });
    });

    // Optimistic: the switch moves before the server answers.
    await waitFor(() => {
        expect(selfInCache()?.settings.timeFormat).toBe('24h');
    });
    expect(result.current.isPending).toBe(true);
    gate.resolve();
    await act(() => done);

    expect(bodies).toEqual([{ settings: { timeFormat: '24h' } }]);
    expect(selfInCache()?.settings.timeFormat).toBe('24h');
    expect(getLocalUser()?.settings.timeFormat).toBe('24h');
    expect(toast.error).not.toHaveBeenCalled();
});

test('updateSelf sends an empty display name as it is', async () => {
    signInWithCachedSelf();
    const bodies = servePatch();
    const { result } = renderHook(() => useUpdateSelf());

    await act(() => result.current.updateSelf({ displayName: '' }));

    expect(bodies).toEqual([{ displayName: '' }]);
});

test('a failed update rolls the change back, marks the user stale and shows the error', async () => {
    const client = signInWithCachedSelf();
    server.use(
        http.patch('*/users/self', () =>
            HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 400 }),
        ),
    );
    const { result } = renderHook(() => useUpdateSelf());

    // `updateSelf` never rejects: the failure is the toast.
    await act(() => result.current.updateSelf({ settings: { theme: 'dark' } }));

    expect(selfInCache()?.settings.theme).toBe('light');
    expect(getLocalUser()?.settings.theme).toBe('light');
    expect(toast.error).toHaveBeenCalledWith('toasts:common.requestFailed');
    // Reloaded from the server on its next mount (here nothing observes it).
    expect(client.getQueryState(usersKeys.self())?.isInvalidated).toBe(true);
});

test('two quick updates are sent in order and the first response keeps the second change', async () => {
    signInWithCachedSelf();
    const first = deferred();
    const second = deferred();
    const bodies = servePatch([first, second]);
    const { result } = renderHook(() => useUpdateSelf());

    let done: Promise<void>[] = [];
    act(() => {
        done = [
            result.current.updateSelf({ settings: { theme: 'dark' } }),
            result.current.updateSelf({ settings: { sex: 'female' } }),
        ];
    });
    await waitFor(() => {
        expect(selfInCache()?.settings).toMatchObject({ theme: 'dark', sex: 'female' });
    });
    // One request at a time: the second waits for the first.
    expect(bodies).toHaveLength(1);

    first.resolve();
    // The first response does not know the second change: it is still shown.
    await waitFor(() => {
        expect(bodies).toHaveLength(2);
    });
    expect(selfInCache()?.settings).toMatchObject({ theme: 'dark', sex: 'female' });

    second.resolve();
    await act(() => Promise.all(done));
    expect(bodies).toEqual([{ settings: { theme: 'dark' } }, { settings: { sex: 'female' } }]);
    expect(selfInCache()?.settings).toMatchObject({ theme: 'dark', sex: 'female' });
});

test('a self refetch in flight cannot overwrite an update', async () => {
    const client = signInWithCachedSelf();
    const staleLoad = deferred();
    server.use(
        http.get('*/users/self', async () => {
            await staleLoad.promise;
            return HttpResponse.json(toWire(selfUser));
        }),
    );
    servePatch();
    void client.refetchQueries({ queryKey: usersKeys.self() });
    const { result } = renderHook(() => useUpdateSelf());

    await act(() => result.current.updateSelf({ settings: { theme: 'dark' } }));
    staleLoad.resolve();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    expect(selfInCache()?.settings.theme).toBe('dark');
});

test('a response after the session ended writes neither the cache nor LocalUser', async () => {
    signInWithCachedSelf();
    const gate = deferred();
    servePatch([gate]);
    const { result } = renderHook(() => useUpdateSelf());

    let done: Promise<void> = Promise.resolve();
    act(() => {
        done = result.current.updateSelf({ displayName: 'Renamed' });
    });
    await waitFor(() => {
        expect(selfInCache()?.displayName).toBe('Renamed');
    });
    invalidateAuthSession();
    getDefaultTestQueryClient().setQueryData(usersKeys.self(), selfUser);
    gate.resolve();
    await act(() => done);

    expect(selfInCache()?.displayName).toBe('User');
});

test('settings are refused offline: no request, a toast, nothing changes', async () => {
    signInWithCachedSelf();
    const bodies = servePatch();
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useUpdateSelf());

    await act(() => result.current.updateSelf({ settings: { theme: 'dark' } }));

    expect(bodies).toEqual([]);
    expect(selfInCache()?.settings.theme).toBe('light');
    expect(toast.error).toHaveBeenCalledWith('errors:network.offline');
});

test('no writes signed out or on the anonymous client', async () => {
    const bodies = servePatch();
    const { result, rerender } = renderHook(() => ({
        updateSelf: useUpdateSelf().updateSelf,
        removeKnownUser: useRemoveKnownUser().removeKnownUser,
    }));

    // Signed out.
    await act(() => result.current.updateSelf({ settings: { theme: 'dark' } }));
    // Signed in, but the user's client does not exist yet (a first sign-in).
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    rerender();
    await act(() => result.current.updateSelf({ settings: { theme: 'dark' } }));
    await expect(result.current.removeKnownUser('friend-1')).rejects.toBeInstanceOf(
        UserWriteRefusedError,
    );

    expect(bodies).toEqual([]);
    expect(toast.error).not.toHaveBeenCalled();
});

test('uploadAvatar sends the file as multipart data and keeps the new picture', async () => {
    signInWithCachedSelf();
    const picture = 'https://cdn.example.com/a.webp';
    const contentTypes: (string | null)[] = [];
    server.use(
        http.put('*/users/self/avatar', ({ request }) => {
            contentTypes.push(request.headers.get('content-type'));
            return HttpResponse.json(toWire({ ...selfUser, picture }));
        }),
    );
    const file = new File(['avatar'], 'a.webp', { type: 'image/webp' });
    const { result } = renderHook(() => useUploadAvatar());

    const onProgress = vi.fn();
    const user = await act(() => result.current.uploadAvatar({ file, onProgress }));

    expect(user.picture).toBe(picture);
    expect(contentTypes).toHaveLength(1);
    expect(contentTypes[0]).toContain('multipart/form-data');
    expect(onProgress).toHaveBeenLastCalledWith(100);
    expect(selfInCache()?.picture).toBe(picture);
});

test('a failed avatar upload rejects with a toast and keeps the picture', async () => {
    signInWithCachedSelf();
    server.use(
        http.put('*/users/self/avatar', () =>
            HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 400 }),
        ),
    );
    const { result } = renderHook(() => useUploadAvatar());

    await expect(
        act(() => result.current.uploadAvatar({ file: new File(['a'], 'a.png') })),
    ).rejects.toBeTruthy();
    expect(selfInCache()?.picture).toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(1);
});

test('the avatar upload is refused offline', async () => {
    signInWithCachedSelf();
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useUploadAvatar());

    await expect(
        result.current.uploadAvatar({ file: new File(['a'], 'a.png') }),
    ).rejects.toBeInstanceOf(UserWriteRefusedError);
    expect(toast.error).toHaveBeenCalledWith('errors:network.offline');
});

const serveKnownUsers = (lists: KnownUser[][]) => {
    let loads = 0;
    server.use(
        http.get('*/users/known-users', () => {
            const friends = lists[Math.min(loads, lists.length - 1)] ?? [];
            loads += 1;
            return HttpResponse.json({
                friends: friends.map(friend => ({
                    user: friend.user,
                    balances: [],
                    lastUsedCurrency: null,
                })),
            });
        }),
    );
    return () => loads;
};

test('removeKnownUser deletes the friend and settles after the friends reloaded', async () => {
    const client = signInWithCachedSelf();
    client.setQueryData(usersKeys.known(), [createKnownUser('friend-1')]);
    const deleted: string[] = [];
    server.use(
        http.delete('*/users/known-users/:id', ({ params }) => {
            deleted.push(String(params.id));
            return new HttpResponse(null, { status: 204 });
        }),
    );
    const loads = serveKnownUsers([[]]);
    const { result } = renderHook(() => useRemoveKnownUser());

    await act(() => result.current.removeKnownUser('friend-1'));

    expect(deleted).toEqual(['friend-1']);
    expect(loads()).toBe(0);
    // An inactive `users.known` is marked stale: its next mount reloads it.
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
});

test('a failed friend removal rejects with a toast and keeps the friends', async () => {
    const client = signInWithCachedSelf();
    client.setQueryData(usersKeys.known(), [createKnownUser('friend-1')]);
    server.use(
        http.delete('*/users/known-users/:id', () =>
            HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 400 }),
        ),
    );
    const { result } = renderHook(() => useRemoveKnownUser());

    await expect(act(() => result.current.removeKnownUser('friend-1'))).rejects.toBeTruthy();
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
});

test('removing a friend is refused offline and with an invalid id', async () => {
    signInWithCachedSelf();
    const { result } = renderHook(() => useRemoveKnownUser());

    await expect(act(() => result.current.removeKnownUser('a/b'))).rejects.toBeTruthy();
    onlineManager.setOnline(false);
    await expect(result.current.removeKnownUser('friend-1')).rejects.toBeInstanceOf(
        UserWriteRefusedError,
    );
});

test('accepting a friend invite returns the friend and marks the friends stale', async () => {
    const client = signInWithCachedSelf();
    client.setQueryData(usersKeys.known(), []);
    const tokens: string[] = [];
    server.use(
        http.post('*/users/invite/:inviteToken', ({ params }) => {
            tokens.push(String(params.inviteToken));
            return HttpResponse.json({
                id: 'friend-1',
                email: 'friend@example.com',
                displayName: 'Friend',
                createdAt: 1,
                updatedAt: 1,
            });
        }),
    );
    const { result } = renderHook(() => useAcceptFriendInvite());

    const friend = await act(() => result.current('friend-token'));

    expect(friend).toEqual({ id: 'friend-1', displayName: 'Friend' });
    expect(tokens).toEqual(['friend-token']);
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
});

test('accepting an invite is refused on the anonymous client', async () => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    const { result } = renderHook(() => useAcceptFriendInvite());

    await expect(result.current('friend-token')).rejects.toBeInstanceOf(UserWriteRefusedError);
});

test('the dev menu extends the shown subscription by one day', async () => {
    const client = signInWithCachedSelf();
    client.setQueryData(usersKeys.self(), { ...selfUser, subscriptionUntil: 1_000 });
    const { result } = renderHook(() => useExtendSubscriptionByDay());

    act(() => {
        result.current();
    });

    await waitFor(() => {
        expect(selfInCache()?.subscriptionUntil).toBe(1_000 + 86_400);
    });
});
