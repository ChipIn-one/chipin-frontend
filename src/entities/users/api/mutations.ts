// The users entity mutations (spec 03 §6 row 3): the self user's profile and settings, the avatar,
// removing a friend and accepting a friend invite. Online only (spec 03 §2.9): no retry, and the
// hooks refuse them offline before `mutate`. Every lifecycle callback
// lives here (spec 03 §2.1): the hooks pass only the variables.
import type { MutationFunctionContext, QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import { isAuthSessionCurrent } from 'helpers/authSession';
import { api } from 'shared/api/client';
import { isNetworkUsable } from 'shared/offline/network';

import { toSelfUser } from '../model/toSelfUser';
import type { SelfUser, SelfUserSettings } from '../model/types';

import { syncLocalUser, usersKeys } from './queries';

export const usersMutationKeys = {
    updateSelf: ['users', 'updateSelf'] as const,
    uploadAvatar: ['users', 'uploadAvatar'] as const,
    removeKnownUser: ['users', 'removeKnownUser'] as const,
    acceptFriendInvite: ['users', 'acceptFriendInvite'] as const,
};

// The profile writes (settings and avatar) run one at a time, in call order, so the responses
// arrive in that order too.
const SELF_SCOPE = { id: 'users.self' };

/** Whether a settings or avatar write is still pending: its response is newer than any load. */
export const isSelfWritePending = (client: QueryClient): boolean =>
    client.isMutating({ predicate: mutation => mutation.options.scope?.id === SELF_SCOPE.id }) > 0;

export interface UpdateSelfParams {
    displayName?: string;
    settings?: Partial<SelfUserSettings>;
}

/**
 * Why a write was not sent: `session` — the auth session it was made in has ended (expired,
 * signed out, switched) before its turn in the queue; `offline` — the network went away before
 * its turn (spec 03 §2.9: these writes are never queued for a reconnect).
 */
export type UserWriteRefusal = 'session' | 'offline';

/** A users write refused before it was sent. */
export class UserWriteRefusedError extends Error {
    readonly reason: UserWriteRefusal;

    constructor(reason: UserWriteRefusal) {
        super(`User write refused: ${reason}`);
        this.reason = reason;
    }
}

/** The variables of a self write: the auth session it was made in is checked before it is sent. */
interface SessionBound {
    /** `getAuthSessionVersion()` when the write was made. */
    sessionVersion: number;
}

export interface UpdateSelfVariables extends SessionBound {
    changes: UpdateSelfParams;
}

export interface UploadAvatarParams {
    file: File;
    /** Upload progress, 0–100. */
    onProgress?: (progress: number) => void;
}

export type UploadAvatarVariables = UploadAvatarParams & SessionBound;

/** The friend whose invite was accepted. */
export interface AcceptedFriend {
    id: string;
    displayName: string;
}

// A queued self write runs after the previous one settles: by then its session may have ended, or
// the network gone. It is refused then, never sent with another session's token or held paused.
const refuseIfStale = ({ sessionVersion }: SessionBound): Promise<void> => {
    if (!isAuthSessionCurrent(sessionVersion)) {
        return Promise.reject(new UserWriteRefusedError('session'));
    }
    return isNetworkUsable()
        ? Promise.resolve()
        : Promise.reject(new UserWriteRefusedError('offline'));
};

const withChanges = (user: SelfUser, changes: UpdateSelfParams): SelfUser => ({
    ...user,
    ...(changes.displayName !== undefined && { displayName: changes.displayName }),
    settings: { ...user.settings, ...changes.settings },
});

const isUpdateSelfVariables = (variables: unknown): variables is UpdateSelfVariables =>
    typeof variables === 'object' && variables !== null && 'changes' in variables;

// The settings writes still waiting (optimistic in the cache), except `current`, in call order.
const pendingChanges = (
    client: QueryClient,
    current: UpdateSelfVariables | null,
): UpdateSelfParams[] =>
    client
        .getMutationCache()
        .findAll({ mutationKey: usersMutationKeys.updateSelf, status: 'pending' })
        .map(mutation => mutation.state.variables)
        .filter(isUpdateSelfVariables)
        .filter(variables => variables !== current)
        .map(variables => variables.changes);

// A user (confirmed by the server, or rolled back) with the writes still pending applied over it:
// nothing hides a later optimistic change.
const withPending = (
    client: QueryClient,
    user: SelfUser,
    current: UpdateSelfVariables | null,
): SelfUser => pendingChanges(client, current).reduce(withChanges, user);

// Cancel before set: a refetch still in flight read the user before this write, and would
// overwrite it when it lands.
const setSelf = (client: QueryClient, update: (user: SelfUser) => SelfUser): Promise<void> =>
    client.cancelQueries({ queryKey: usersKeys.self() }).then(() => {
        const user = client.getQueryData<SelfUser>(usersKeys.self());

        if (user) {
            client.setQueryData(usersKeys.self(), update(user));
        }
    });

// A response for the user of a previous session (signed out or switched while it was in flight)
// writes nothing: the session that started the write has ended.
const writeConfirmedSelf = (
    client: QueryClient,
    user: SelfUser,
    variables: SessionBound,
    current: UpdateSelfVariables | null,
): Promise<void> => {
    if (!isAuthSessionCurrent(variables.sessionVersion)) {
        return Promise.resolve();
    }
    syncLocalUser(user);
    return client.cancelQueries({ queryKey: usersKeys.self() }).then(() => {
        client.setQueryData(usersKeys.self(), withPending(client, user, current));
    });
};

interface UpdateSelfContext {
    previous: SelfUser | undefined;
}

// The fields `changes` wrote, back to their values before it.
const revertChanges = (user: SelfUser, changes: UpdateSelfParams, previous: SelfUser): SelfUser => {
    const settings: Partial<SelfUserSettings> = Object.fromEntries(
        Object.keys(changes.settings ?? {}).map(key => [key, Reflect.get(previous.settings, key)]),
    );

    return withChanges(user, {
        ...(changes.displayName !== undefined && { displayName: previous.displayName }),
        settings,
    });
};

// The two self writes run in the scope queue and check the network themselves before they are
// sent (`refuseIfStale`): `networkMode: 'always'`, so a write whose turn comes offline fails at
// once (rolled back, a toast) instead of waiting paused for a reconnect.
const SELF_WRITE_DEFAULTS = { scope: SELF_SCOPE, networkMode: 'always', retry: false } as const;

/** `PATCH /users/self`: optimistic, rolled back on an error or a refusal. */
export const updateSelfMutationOptions = () =>
    mutationOptions<SelfUser, Error, UpdateSelfVariables, UpdateSelfContext>({
        ...SELF_WRITE_DEFAULTS,
        mutationKey: usersMutationKeys.updateSelf,
        mutationFn: variables =>
            refuseIfStale(variables)
                .then(() =>
                    api('patch', '/users/self', {
                        body: {
                            ...(variables.changes.displayName !== undefined && {
                                displayName: variables.changes.displayName,
                            }),
                            ...(variables.changes.settings && {
                                settings: variables.changes.settings,
                            }),
                        },
                    }),
                )
                .then(toSelfUser),
        onMutate: ({ changes }, { client }: MutationFunctionContext) => {
            const previous = client.getQueryData<SelfUser>(usersKeys.self());

            return setSelf(client, user => withChanges(user, changes)).then(() => ({ previous }));
        },
        onSuccess: (user, variables, _context, { client }) =>
            writeConfirmedSelf(client, user, variables, variables),
        // Rolled back in this user's own client even after the session ended (the change was
        // never confirmed); a client cleared by `clearUserData` has nothing to roll back.
        onError: (_error, variables, context, { client }) => {
            const previous = context?.previous;

            if (!previous) {
                return undefined;
            }
            return setSelf(client, user =>
                withPending(client, revertChanges(user, variables.changes, previous), variables),
            ).then(() => {
                // Nothing else pending: reload what the server holds now. After the session ended
                // the entry is only marked stale (a disabled query sends nothing): the next
                // session of this user reloads it instead of showing an unconfirmed value.
                if (pendingChanges(client, variables).length === 0) {
                    return client.invalidateQueries({ queryKey: usersKeys.self() });
                }
                return undefined;
            });
        },
    });

// Whole percent, 0–100 (a progress bar, not an amount).
const toProgress = (loaded: number, total: number): number =>
    Math.min(Math.max(Math.floor((loaded * 100) / total), 0), 100);

/** `PUT /users/self/avatar` (multipart, with upload progress); never optimistic. */
export const uploadAvatarMutationOptions = () =>
    mutationOptions<SelfUser, Error, UploadAvatarVariables>({
        ...SELF_WRITE_DEFAULTS,
        mutationKey: usersMutationKeys.uploadAvatar,
        mutationFn: variables =>
            refuseIfStale(variables)
                .then(() => {
                    const body = new FormData();

                    body.append('file', variables.file);
                    return api('put', '/users/self/avatar', {
                        body,
                        onUploadProgress: event => {
                            if (event.total) {
                                variables.onProgress?.(toProgress(event.loaded, event.total));
                            }
                        },
                    });
                })
                .then(toSelfUser),
        // The settings writes still pending stay shown over the new picture.
        onSuccess: (user, variables, _context, { client }) =>
            writeConfirmedSelf(client, user, variables, null),
    });

// After a change of the friends: a running load may predate it, so it is cancelled and restarted.
const reloadKnownUsers = (client: QueryClient): Promise<void> =>
    client
        .cancelQueries({ queryKey: usersKeys.known() })
        .then(() => client.invalidateQueries({ queryKey: usersKeys.known() }));

/** `DELETE /users/known-users/{id}`; settles once the friends list has reloaded. */
export const removeKnownUserMutationOptions = () =>
    mutationOptions<void, Error, { userId: string }>({
        mutationKey: usersMutationKeys.removeKnownUser,
        networkMode: 'online',
        retry: false,
        mutationFn: ({ userId }) =>
            api('delete', '/users/known-users/{id}', { params: { id: userId } }).then(
                () => undefined,
            ),
        onSuccess: (_data, _params, _context, { client }) => reloadKnownUsers(client),
    });

/** `POST /users/invite/{inviteToken}`; the friends list reloads (the accept never waits for it). */
export const acceptFriendInviteMutationOptions = () =>
    mutationOptions<AcceptedFriend, Error, { inviteToken: string }>({
        mutationKey: usersMutationKeys.acceptFriendInvite,
        networkMode: 'online',
        retry: false,
        mutationFn: ({ inviteToken }) =>
            api('post', '/users/invite/{inviteToken}', { params: { inviteToken } }).then(
                friend => ({ id: friend.id, displayName: friend.displayName }),
            ),
        // The invite is accepted once the POST succeeds: a failed reload must not reject it.
        onSuccess: (_friend, _params, _context, { client }) =>
            reloadKnownUsers(client).catch(() => undefined),
    });
