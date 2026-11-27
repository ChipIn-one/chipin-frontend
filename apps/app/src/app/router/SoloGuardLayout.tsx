import type { QueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, redirect } from 'react-router-dom';

import { authReady } from 'app/auth/session';
import { ROUTES } from 'constants/routes';
import { canRoleAccessSolo, type SelfUser, usersKeys } from 'entities/users';
import { useCanAccessSolo, useSelfUserState } from 'hooks/useSelfUser';
import { restoreReady } from 'shared/offline/restore';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import { PageLoader } from 'basics/PageLoader';

/**
 * The loader of `SoloGuardLayout` (spec 04 §2.3): a signed-in user whose cached profile has no Solo
 * access goes to the dashboard before the page loads. Without a cached profile it lets through
 * and the layout decides once the profile arrives (03-9 moves this to the query cache with
 * `ensureQueryData`). It waits for the session as `requireSession` does, so a signed-out user stays
 * on the URL under the auth modal.
 */
const soloGuardLoader =
    (queryClient: QueryClient) =>
    ({ request }: { request: Request }): Promise<Response | null> =>
        restoreReady
            .then(() => authReady(new URL(request.url).pathname))
            .then(() => {
                const user = queryClient.getQueryData<SelfUser>(usersKeys.self());

                return useAuthStore.getState().status === AUTH_STATUS.AUTHENTICATED &&
                    user !== undefined &&
                    !canRoleAccessSolo(user.role)
                    ? redirect(ROUTES.DASHBOARD)
                    : null;
            });

/** The Solo guard as `SoloRouteGuard` was: it follows the profile that arrives after the loader. */
const SoloGuardLayout = () => {
    const isUserFetched = useSelfUserState().isFetched;
    const canAccessSolo = useCanAccessSolo();
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);

    if (!isUserFetched) {
        return <PageLoader />;
    }

    // AUTH-077: an expired session derives no role (D16), but the shown page stays where it is,
    // hidden by `AuthLayout` under the sign-in modal; the guard decides again once signed in.
    if (!canAccessSolo && isSignedIn) {
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    return <Outlet />;
};

export { SoloGuardLayout, soloGuardLoader };
