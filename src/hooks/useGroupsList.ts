// The user's groups list for the UI (spec 03 §6 row 4). Like the known users (`useKnownUsers`), the
// query sends a request only while signed in (online, or `offline-cached` reading the cache) and on
// the user's persisted client: the anonymous client of a first sign-in, before the user's client
// exists, never requests it. Signed out or on another client nothing is read.
import { useQueryClient } from '@tanstack/react-query';

import type { Group } from 'api/chipin.types';
import { useGroupsListQuery } from 'entities/groups';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

const NO_GROUPS: Group[] = [];

export interface GroupsListResult {
    /** Undefined until the first load or while signed out. */
    groups: Group[] | undefined;
    /** The first load failed, or it waits for the network, with nothing cached. */
    isError: boolean;
    /** Signed in, nothing cached yet and no error: the first load is pending. */
    isLoading: boolean;
    /** A refetch failed while data is shown (not a paused one: offline the banner says so). */
    hasRefreshError: boolean;
    /** Reloads the groups; does nothing while the query is disabled (signed out, another client). */
    refetch: () => Promise<unknown>;
}

const skipRefetch = (): Promise<undefined> => Promise.resolve(undefined);

/**
 * The groups with the query state a page needs: an error only without data (spec 03 §1.2), and a
 * fetch paused offline without data counts as an error (§1.8).
 */
export const useGroupsList = (): GroupsListResult => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isUserClient = isUserCacheClient(useQueryClient());
    const isEnabled = isSignedIn && isUserClient;
    const query = useGroupsListQuery({ enabled: isEnabled });
    const groups = isEnabled ? query.data : undefined;
    const isError = isEnabled && groups === undefined && (query.isError || query.isPaused);

    return {
        groups,
        isError,
        // Signed in on the anonymous client (a first sign-in before the remount onto the user's
        // client) the groups are still to come: loading, never read from that client.
        isLoading: isSignedIn && groups === undefined && !isError,
        hasRefreshError: groups !== undefined && query.isError,
        refetch: isEnabled ? query.refetch : skipRefetch,
    };
};

/** The groups, or an empty list (the same array each render) before they are loaded. */
export const useGroups = (): Group[] => useGroupsList().groups ?? NO_GROUPS;
