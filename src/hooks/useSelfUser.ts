// The self user for the UI (spec 03 §6 row 3): the `users.self` query, requested only while signed
// in (online, or `offline-cached` reading the cache) and on the user's persisted client: the
// public pages and the anonymous client of a first sign-in read the cached user instead (the
// session loader, `store/internal/sessionUser`, hands the user to the new client). Settings and
// role fall back to the cached `LocalUser` until the query has data: signed out, the landing reads
// the language and theme there (spec 03 §1.5).
import { useQueryClient } from '@tanstack/react-query';

import { type SelfUser, type SelfUserSettings, useSelfUserQuery } from 'entities/users';
import { canRoleAccessSolo, isAdminRole } from 'entities/users';
import { getLocalUser, type LocalUser } from 'helpers/localStorage';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

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
    /** Reloads the user; does nothing while the query is disabled (signed out, another client). */
    refetch: () => Promise<unknown>;
}

const skipRefetch = (): Promise<undefined> => Promise.resolve(undefined);

/**
 * The self user with the state a guard or a page needs. An offline-cached session reads the cache
 * and never waits for the network: a load paused offline without data counts as settled.
 */
export const useSelfUserState = (): SelfUserState => {
    const isSignedIn = useIsSignedIn();
    const isEnabled = useIsSelfUserQueryEnabled();
    const query = useSelfUserQueryResult();
    const user = isEnabled ? (query.data ?? null) : null;
    const isError = isEnabled && user === null && (query.isError || query.isPaused);

    return {
        user,
        isLoading: isSignedIn && user === null && !isError,
        isFetched: user !== null || isError,
        isError,
        hasRefreshError: user !== null && query.isError,
        refetch: isEnabled ? query.refetch : skipRefetch,
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
