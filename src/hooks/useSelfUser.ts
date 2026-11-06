// The self user for the UI (spec 03 §6 row 3): the `users.self` query, requested only while signed
// in (online, or `offline-cached` reading the cache). Settings and role fall back to the cached
// `LocalUser` until the query has data: signed out, the landing reads the language and theme there
// (spec 03 §1.5).
import { useQueryClient } from '@tanstack/react-query';

import { type SelfUser, type SelfUserSettings, useSelfUserQuery } from 'entities/users';
import { canRoleAccessSolo, isAdminRole } from 'entities/users';
import { getLocalUser, type LocalUser } from 'helpers/localStorage';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';

const useIsSignedIn = (): boolean =>
    useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);

// The query sends a request only signed in, on the user's persisted client (the public pages and
// the anonymous client read the cached user instead: the store's load seeds the user's client),
// and not while the users store loads the self user (it seeds the query, spec 03 §6 row 3): a
// session start sends one request.
const useIsSelfUserQueryEnabled = (): boolean => {
    const isSignedIn = useIsSignedIn();
    const isUserClient = isUserCacheClient(useQueryClient());
    const isStoreLoading = useLoadingStore(state => state.users.self === 'loading');

    return isSignedIn && isUserClient && !isStoreLoading;
};

const identity = (user: SelfUser): SelfUser => user;

/** The whole query result, for pages that tell loading, error and data apart. */
export const useSelfUserQueryResult = () =>
    useSelfUserQuery({ select: identity, enabled: useIsSelfUserQueryEnabled() });

/** The self user, or null before the query has data. */
export const useSelfUser = (): SelfUser | null => useSelfUserQueryResult().data ?? null;

const useSelfOrLocal = <T>(
    fromUser: (user: SelfUser) => T,
    fromLocal: (localUser: LocalUser | null) => T,
): T => {
    const isSignedIn = useIsSignedIn();
    const query = useSelfUserQuery({ select: fromUser, enabled: useIsSelfUserQueryEnabled() });

    // Signed out the cached user decides, whatever the client still holds. While the store
    // reloads the user, the cached entry stays readable.
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
