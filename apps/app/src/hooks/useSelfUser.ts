// The self user for the UI (spec 03 §6 row 3): the `users.self` query, requested only while signed
// in (online, or `offline-cached` reading the cache) and on the user's persisted client: the
// public pages and the anonymous client of a first sign-in read the cached user instead (the
// session loader, `store/sessionUser`, hands the user to the new client). Settings and
// role fall back to the cached `LocalUser` until the query has data: signed out, the landing reads
// the language and theme there (spec 03 §1.5).
import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { type SelfUser, type SelfUserSettings, useSelfUserQuery } from 'entities/users';
import { canRoleAccessSolo, isAdminRole } from 'entities/users';
import { getLocalUser, type LocalUser } from 'helpers/localStorage';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import {
    getSessionSelfLoad,
    loadSelfUserForSession,
    type SessionSelfLoad,
    subscribeSessionSelfLoad,
} from 'store/sessionUser';

const useIsSignedIn = (): boolean =>
    useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);

const useIsSelfUserQueryEnabled = (): boolean => {
    const isSignedIn = useIsSignedIn();
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
};

const identity = (user: SelfUser): SelfUser => user;

/** The whole query result, for pages that tell loading, error and data apart. */
export const useSelfUserQueryResult = () =>
    useSelfUserQuery({ select: identity, enabled: useIsSelfUserQueryEnabled() });

/** The self user, or null before the query has data. */
export const useSelfUser = (): SelfUser | null => useSelfUserQueryResult().data ?? null;

export interface SelfUserState {
    user: SelfUser | null;
    /** Signed in and nothing to show yet: the first load is pending (or the remount still to come). */
    isLoading: boolean;
    /** The user is shown, or its first load has settled without data (failed, or offline). */
    isFetched: boolean;
    /** Nothing to show: the load failed, or it waits for the network (spec 03 §1.2, §1.8). */
    isError: boolean;
    /** A reload failed while the user is shown (not a paused one: offline the banner says so). */
    hasRefreshError: boolean;
    /**
     * Reloads the user: the query on the user's client, the session load on the anonymous client
     * of a first sign-in; does nothing signed out.
     */
    refetch: () => Promise<unknown>;
}

const skipRefetch = (): Promise<undefined> => Promise.resolve(undefined);

const retrySessionLoad = (): Promise<unknown> => loadSelfUserForSession();

/** The latest session self load (`store/sessionUser`), for readers without the user's client. */
export const useSessionSelfLoad = (): SessionSelfLoad =>
    useSyncExternalStore(subscribeSessionSelfLoad, getSessionSelfLoad, getSessionSelfLoad);

/**
 * The self user with the state a guard or a page needs. An offline-cached session reads the cache
 * and never waits for the network: a load paused offline without data counts as settled. Signed
 * in on the anonymous client (a first sign-in before the remount), the session load decides: a
 * failed one settles with an error, and Retry runs it again (success remounts onto the user's
 * client).
 */
export const useSelfUserState = (): SelfUserState => {
    const isSignedIn = useIsSignedIn();
    const isEnabled = useIsSelfUserQueryEnabled();
    const query = useSelfUserQueryResult();
    const sessionLoad = useSessionSelfLoad();
    const isOnAnonymousClient = isSignedIn && !isEnabled;
    const user = isEnabled ? (query.data ?? null) : null;
    const isError = isEnabled
        ? user === null && (query.isError || query.isPaused)
        : isOnAnonymousClient && sessionLoad.status === 'failed';

    return {
        user,
        isLoading: isSignedIn && user === null && !isError,
        isFetched: user !== null || isError,
        isError,
        hasRefreshError: user !== null && query.isError,
        refetch: isEnabled ? query.refetch : isOnAnonymousClient ? retrySessionLoad : skipRefetch,
    };
};

const useSelfOrLocal = <T>(
    fromUser: (user: SelfUser) => T,
    fromLocal: (localUser: LocalUser | null) => T,
): T => {
    const isSignedIn = useIsSignedIn();
    const query = useSelfUserQuery({ select: fromUser, enabled: useIsSelfUserQueryEnabled() });

    // Signed out the cached user decides, whatever the client still holds. While the session
    // loader reloads the user, the cached entry stays readable.
    return isSignedIn && query.isSuccess ? query.data : fromLocal(getLocalUser());
};

/** One value of the user's settings: pass a module-level picker (it is the query's `select`). */
export const useUserSetting = <T>(pick: (settings: SelfUserSettings | null) => T): T =>
    useSelfOrLocal(
        user => pick(user.settings),
        localUser => pick(localUser?.settings ?? null),
    );

export const useIsUserAdmin = (): boolean =>
    useSelfOrLocal(
        user => isAdminRole(user.role),
        localUser => isAdminRole(localUser?.role),
    );

export const useCanAccessSolo = (): boolean =>
    useSelfOrLocal(
        user => canRoleAccessSolo(user.role),
        localUser => canRoleAccessSolo(localUser?.role),
    );
