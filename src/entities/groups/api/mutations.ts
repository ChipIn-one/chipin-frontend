// The groups entity mutations (spec 03 §6 row 4): create, update, cover, join, leave, kick and
// remove. Online only (spec 03 §2.1, §2.9): no outbox, no retry, and the hooks refuse them offline
// before `mutate`. A returned group maps through `toGroup`. The cache writes live here, on the
// mutation's own client; a write whose auth session has ended (a sign-out, an account switch, an
// expired session) writes nothing. What the stores do after a write (the last-group default, the
// legacy activity store) is passed in (`GroupWriteEffects`): entities never import `store`.
import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import { dashboardKeys, trimDashboardFeed } from 'entities/dashboard';
import { usersKeys } from 'entities/users';
import { isAuthSessionCurrent } from 'helpers/authSession';
import { api } from 'shared/api/client';

import { toGroup } from '../model/toGroup';
import type { Group } from '../model/types';

import {
    forgetGroup,
    putGroupAndReloadList,
    refreshGroup,
    reloadGroupsList,
    writeGroupDetail,
} from './groupCache';
import { putGroupInCachedList } from './listCache';

export const groupsMutationKeys = {
    create: ['groups', 'create'] as const,
    update: ['groups', 'update'] as const,
    uploadCover: ['groups', 'uploadCover'] as const,
    join: ['groups', 'join'] as const,
    leave: ['groups', 'leave'] as const,
    kick: ['groups', 'kick'] as const,
    remove: ['groups', 'remove'] as const,
};

/** The variables of a group write: the auth session it was made in, checked before any write. */
interface SessionBound {
    /** `getAuthSessionVersion()` when the write was made. */
    sessionVersion: number;
}

export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
}

export interface UpdateGroupParams {
    groupId: string;
    groupName?: string;
    groupDescription?: string;
    simplifyDebts?: boolean;
}

export interface UploadGroupCoverParams {
    groupId: string;
    file: File;
    /** Upload progress, 0–100. */
    onProgress?: (progress: number) => void;
}

export interface LeaveGroupParams {
    groupId: string;
    /** Required when the owner leaves a group with other members. */
    newOwnerId?: string;
}

export interface KickGroupMemberParams {
    groupId: string;
    userId: string;
}

export type CreateGroupVariables = CreateGroupParams & SessionBound;
export type UpdateGroupVariables = UpdateGroupParams & SessionBound;
export type UploadGroupCoverVariables = UploadGroupCoverParams & SessionBound;
export type JoinGroupVariables = { inviteToken: string } & SessionBound;
export type LeaveGroupVariables = LeaveGroupParams & SessionBound;
export type KickGroupMemberVariables = KickGroupMemberParams & SessionBound;
export type RemoveGroupVariables = { groupId: string } & SessionBound;

/** What the caller's stores do after a group write, only while its session is current. */
export interface GroupWriteEffects {
    /** The user lost the group (removed it, or left it without rejoining meanwhile). */
    onGroupGone: (groupId: string) => Promise<void>;
    /** The members of the group changed (a member was kicked). */
    onMembersChanged: (groupId: string) => Promise<void>;
}

const ONLINE_WRITE = { networkMode: 'online', retry: false } as const;

const isCurrent = ({ sessionVersion }: SessionBound): boolean =>
    isAuthSessionCurrent(sessionVersion);

// After a change of the friends or the balances: a running load may predate it, so the friends
// list cancels it first; the dashboard feed is cut to one page (one request for its refetch).
const reloadKnownUsers = (client: QueryClient): Promise<void> =>
    client
        .cancelQueries({ queryKey: usersKeys.known() })
        .then(() =>
            client.invalidateQueries({ queryKey: usersKeys.known() }, { cancelRefetch: true }),
        );

const reloadDashboard = (client: QueryClient): Promise<void> => {
    trimDashboardFeed(client);
    return client.invalidateQueries({ queryKey: dashboardKeys.all });
};

// The successful joins of each group on each client: a leave that a rejoin overtook does not
// forget the group (the join is newer).
const joinCounts = new WeakMap<QueryClient, Map<string, number>>();

const joinCountOf = (client: QueryClient, groupId: string): number =>
    joinCounts.get(client)?.get(groupId) ?? 0;

const countJoin = (client: QueryClient, groupId: string): void => {
    const counts = joinCounts.get(client) ?? new Map<string, number>();

    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    joinCounts.set(client, counts);
};

// The group is gone for this user: its cached detail and activity, and what showed it.
const afterGroupGone = (
    client: QueryClient,
    groupId: string,
    effects: GroupWriteEffects,
): Promise<void> => {
    forgetGroup(client, groupId);
    return Promise.all([
        reloadGroupsList(client),
        reloadKnownUsers(client),
        reloadDashboard(client),
        effects.onGroupGone(groupId),
    ]).then(() => undefined);
};

// A group a write returned (update, cover, join): its detail at once, then the list reloads with it.
const afterGroupWritten = (
    client: QueryClient,
    group: Group,
    variables: SessionBound,
): Promise<void> => {
    void writeGroupDetail(client, group);
    return putGroupAndReloadList(client, group, () => isCurrent(variables));
};

// Whole percent, 0–100 (a progress bar, not an amount).
const toProgress = (loaded: number, total: number): number =>
    Math.min(Math.max(Math.floor((loaded * 100) / total), 0), 100);

/** `POST /groups`; the new group is listed and becomes its detail without a request. */
export const createGroupMutationOptions = () =>
    mutationOptions<Group, Error, CreateGroupVariables>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.create,
        mutationFn: ({ groupName, groupDescription }) =>
            api('post', '/groups', {
                body: {
                    name: groupName,
                    ...(groupDescription && { description: groupDescription }),
                },
            }).then(toGroup),
        onSuccess: (group, variables, _context, { client }) => {
            if (isCurrent(variables)) {
                void writeGroupDetail(client, group);
                void putGroupInCachedList(client, group);
            }
        },
    });

/** `PATCH /groups/{id}`; settles once the list has reloaded with the updated group. */
export const updateGroupMutationOptions = () =>
    mutationOptions<Group, Error, UpdateGroupVariables>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.update,
        mutationFn: ({ groupId, groupName, groupDescription, simplifyDebts }) =>
            api('patch', '/groups/{id}', {
                params: { id: groupId },
                body: {
                    ...(groupName !== undefined && { name: groupName }),
                    ...(groupDescription !== undefined && { description: groupDescription }),
                    ...(simplifyDebts !== undefined && { simplifyDebts }),
                },
            }).then(toGroup),
        onSuccess: (group, variables, _context, { client }) =>
            isCurrent(variables) ? afterGroupWritten(client, group, variables) : undefined,
    });

/** `PUT /groups/{id}/cover` (multipart, with upload progress); as an update. */
export const uploadGroupCoverMutationOptions = () =>
    mutationOptions<Group, Error, UploadGroupCoverVariables>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.uploadCover,
        mutationFn: ({ groupId, file, onProgress }) => {
            const body = new FormData();

            body.append('file', file);
            return api('put', '/groups/{id}/cover', {
                params: { id: groupId },
                body,
                onUploadProgress: event => {
                    if (event.total) {
                        onProgress?.(toProgress(event.loaded, event.total));
                    }
                },
            }).then(toGroup);
        },
        onSuccess: (group, variables, _context, { client }) =>
            isCurrent(variables) ? afterGroupWritten(client, group, variables) : undefined,
    });

/** `POST /groups/invite/{inviteToken}`; as an update, and a leave running meanwhile keeps it. */
export const joinGroupMutationOptions = () =>
    mutationOptions<Group, Error, JoinGroupVariables>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.join,
        mutationFn: ({ inviteToken }) =>
            api('post', '/groups/invite/{inviteToken}', { params: { inviteToken } }).then(toGroup),
        onSuccess: (group, variables, _context, { client }) => {
            if (!isCurrent(variables)) {
                return undefined;
            }
            countJoin(client, group.id);
            return afterGroupWritten(client, group, variables);
        },
    });

interface LeaveContext {
    /** The successful joins of the group when the leave was sent. */
    joinCount: number;
}

/**
 * `POST /groups/{id}/leave`; settles once what showed the group has reloaded. A rejoin that
 * succeeded meanwhile wins: the group is kept.
 */
export const leaveGroupMutationOptions = (effects: GroupWriteEffects) =>
    mutationOptions<void, Error, LeaveGroupVariables, LeaveContext>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.leave,
        onMutate: ({ groupId }, { client }) => ({ joinCount: joinCountOf(client, groupId) }),
        mutationFn: ({ groupId, newOwnerId }) =>
            api('post', '/groups/{id}/leave', {
                params: { id: groupId },
                body: { ...(newOwnerId && { newOwnerId }) },
            }).then(() => undefined),
        onSuccess: (_data, variables, context, { client }) => {
            if (
                !isCurrent(variables) ||
                joinCountOf(client, variables.groupId) !== context.joinCount
            ) {
                return undefined;
            }
            return afterGroupGone(client, variables.groupId, effects);
        },
    });

/** `POST /groups/{id}/members/{userId}/kick`; settles once the group and its effects reloaded. */
export const kickGroupMemberMutationOptions = (effects: GroupWriteEffects) =>
    mutationOptions<void, Error, KickGroupMemberVariables>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.kick,
        mutationFn: ({ groupId, userId }) =>
            api('post', '/groups/{id}/members/{userId}/kick', {
                params: { id: groupId, userId },
            }).then(() => undefined),
        onSuccess: (_data, variables, _context, { client }) => {
            if (!isCurrent(variables)) {
                return undefined;
            }
            return Promise.all([
                refreshGroup(client, variables.groupId),
                reloadKnownUsers(client),
                reloadDashboard(client),
                effects.onMembersChanged(variables.groupId),
            ]).then(() => undefined);
        },
    });

/** `DELETE /groups/{id}`; settles once what showed the group has reloaded. */
export const removeGroupMutationOptions = (effects: GroupWriteEffects) =>
    mutationOptions<void, Error, RemoveGroupVariables>({
        ...ONLINE_WRITE,
        mutationKey: groupsMutationKeys.remove,
        mutationFn: ({ groupId }) =>
            api('delete', '/groups/{id}', { params: { id: groupId } }).then(() => undefined),
        onSuccess: (_data, variables, _context, { client }) =>
            isCurrent(variables) ? afterGroupGone(client, variables.groupId, effects) : undefined,
    });
