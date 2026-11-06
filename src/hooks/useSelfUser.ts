// The self user for the UI (spec 03 §6 row 3): the `users.self` query, requested only while signed
// in (online, or `offline-cached` reading the cache). Settings and role fall back to the cached
// `LocalUser` until the query has data: signed out, the landing reads the language and theme there
// (spec 03 §1.5).
import { type SelfUser, type SelfUserSettings, useSelfUserQuery } from 'entities/users';
import { canRoleAccessSolo, isAdminRole } from 'entities/users';
import { getLocalUser, type LocalUser } from 'helpers/localStorage';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';

// While the users store loads the self user (it seeds the query, spec 03 §6 row 3) the query
// waits, so a session start sends one request.
const useIsSelfUserQueryEnabled = (): boolean => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isStoreLoading = useLoadingStore(state => state.users.self === 'loading');

    return isSignedIn && !isStoreLoading;
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
    const query = useSelfUserQuery({ select: fromUser, enabled: useIsSelfUserQueryEnabled() });

    return query.isSuccess ? query.data : fromLocal(getLocalUser());
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
