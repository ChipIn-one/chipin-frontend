// The users entity mutations (spec 03 §6 row 3): the self user's profile and settings, the avatar,
// removing a friend and accepting a friend invite. Online only (spec 03 §2.9): `networkMode:
// 'online'`, no retry, and the hooks refuse them offline before `mutate`. Every lifecycle callback
// lives here (spec 03 §2.1): the hooks pass only the variables.
import type { MutationFunctionContext, QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { api } from 'shared/api/client';

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

export interface UploadAvatarParams {
    file: File;
    /** Upload progress, 0–100. */
    onProgress?: (progress: number) => void;
}

/** The friend whose invite was accepted. */
export interface AcceptedFriend {
    id: string;
    displayName: string;
}

const withChanges = (user: SelfUser, changes: UpdateSelfParams): SelfUser => ({
    ...user,
    ...(changes.displayName !== undefined && { displayName: changes.displayName }),
    settings: { ...user.settings, ...changes.settings },
});

// The settings writes still waiting (optimistic in the cache), except `current`, in call order.
const pendingChanges = (client: QueryClient, current: UpdateSelfParams): UpdateSelfParams[] =>
    client
        .getMutationCache()
        .findAll({ mutationKey: usersMutationKeys.updateSelf, status: 'pending' })
        .map(mutation => mutation.state.variables)
        .filter((variables): variables is UpdateSelfParams => {
            return typeof variables === 'object' && variables !== null && variables !== current;
        });

// A confirmed user from the server, with the writes still pending applied over it: a response
// never hides a later optimistic change.
const withPending = (client: QueryClient, user: SelfUser, current: UpdateSelfParams): SelfUser =>
    pendingChanges(client, current).reduce(withChanges, user);

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
    sessionVersion: number,
    current?: UpdateSelfParams,
): Promise<void> => {
    if (!isAuthSessionCurrent(sessionVersion)) {
        return Promise.resolve();
    }
    syncLocalUser(user);
    return client.cancelQueries({ queryKey: usersKeys.self() }).then(() => {
        client.setQueryData(
            usersKeys.self(),
            current === undefined ? user : withPending(client, user, current),
        );
    });
};

interface UpdateSelfContext {
    previous: SelfUser | undefined;
    sessionVersion: number;
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

/** `PATCH /users/self`: optimistic, rolled back on an error. */
export const updateSelfMutationOptions = () =>
    mutationOptions<SelfUser, Error, UpdateSelfParams, UpdateSelfContext>({
        mutationKey: usersMutationKeys.updateSelf,
        scope: SELF_SCOPE,
        networkMode: 'online',
        retry: false,
        mutationFn: (changes: UpdateSelfParams) =>
            api('patch', '/users/self', {
                body: {
                    ...(changes.displayName !== undefined && { displayName: changes.displayName }),
                    ...(changes.settings && { settings: changes.settings }),
                },
            }).then(toSelfUser),
        onMutate: (changes, { client }: MutationFunctionContext) => {
            const previous = client.getQueryData<SelfUser>(usersKeys.self());
            const sessionVersion = getAuthSessionVersion();

            return setSelf(client, user => withChanges(user, changes)).then(() => ({
                previous,
                sessionVersion,
            }));
        },
        onSuccess: (user, changes, context, { client }) =>
            writeConfirmedSelf(client, user, context.sessionVersion, changes),
        onError: (_error, changes, context, { client }) => {
            const previous = context?.previous;

            if (!previous || !context || !isAuthSessionCurrent(context.sessionVersion)) {
                return undefined;
            }
            return setSelf(client, user => revertChanges(user, changes, previous)).then(() => {
                // Nothing else pending: reload what the server holds now.
                if (pendingChanges(client, changes).length === 0) {
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
    mutationOptions<SelfUser, Error, UploadAvatarParams, { sessionVersion: number }>({
        mutationKey: usersMutationKeys.uploadAvatar,
        scope: SELF_SCOPE,
        networkMode: 'online',
        retry: false,
        mutationFn: ({ file, onProgress }: UploadAvatarParams) => {
            const body = new FormData();

            body.append('file', file);
            return api('put', '/users/self/avatar', {
                body,
                onUploadProgress: event => {
                    if (event.total) {
                        onProgress?.(toProgress(event.loaded, event.total));
                    }
                },
            }).then(toSelfUser);
        },
        onMutate: () => ({ sessionVersion: getAuthSessionVersion() }),
        onSuccess: (user, _params, context, { client }) =>
            writeConfirmedSelf(client, user, context.sessionVersion),
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
