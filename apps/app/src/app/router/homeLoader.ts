import type { QueryClient } from '@tanstack/react-query';
import { replace } from 'react-router-dom';

import { requireSession } from 'app/auth/requireSession';
import { canRoleAccessSolo, type SelfUser, usersKeys, userSoloModeByDefault } from 'entities/users';
import { getLocalUser } from 'helpers/localStorage';
import { getPreferredModeRoute } from 'helpers/routes';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { selectCanReadUserCache } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

/**
 * The loader of the `home` index (spec 04 §2.2, 04-5a; it replaces `PublicHomeGuard`): `/` always
 * redirects to the preferred mode, Solo when the user may use it and has it as the default, else
 * the dashboard. It runs `requireSession` first (React Router runs this loader in parallel with the
 * one of `AuthLayout` and may take either redirect): a signed-out user gets the same
 * `/login?returnTo=%2F` from both, never a detour through the dashboard.
 *
 * The user is read as `useUserSetting` and `useCanAccessSolo` read it: the cached profile of this
 * router's user client (settings while signed in or expired, role only while signed in), else the
 * cached `LocalUser`. Without a cached profile it does not wait for one: the Solo guard still
 * checks the access on `/solo`.
 *
 * TODO(03-9): unlike `PublicHomeGuard`, it does not wait for the self user when nothing is cached
 * (a first visit falls back to the dashboard). Revisit with `ensureQueryData` of 03-9 before Solo is
 * released (`IS_SOLO_MODE_RELEASED`).
 */
const homeLoader =
    (queryClient: QueryClient) =>
    ({ request }: { request: Request }): Promise<Response> =>
        requireSession({ request }).then(loginRedirect => {
            if (loginRedirect !== null) {
                return loginRedirect;
            }
            const auth = useAuthStore.getState();
            const cached = isUserCacheClient(queryClient)
                ? queryClient.getQueryData<SelfUser>(usersKeys.self())
                : undefined;
            const localUser = getLocalUser();
            const soloModeByDefault =
                cached !== undefined && selectCanReadUserCache(auth)
                    ? userSoloModeByDefault(cached.settings)
                    : userSoloModeByDefault(localUser?.settings ?? null);
            const canAccessSolo =
                cached !== undefined && auth.status === AUTH_STATUS.AUTHENTICATED
                    ? canRoleAccessSolo(cached.role)
                    : canRoleAccessSolo(localUser?.role);

            // `replace`, as `PublicHomeGuard`'s `<Navigate replace>`: on a cold load of `/` (the PWA
            // start URL) `/` does not stay in the history, so Back does not land on the redirect
            // again. (On an in-app PUSH to `/` React Router would replace the previous entry; the
            // app has no such link: the OAuth callback already navigates with `replace`.)
            return replace(getPreferredModeRoute(canAccessSolo && soloModeByDefault));
        });

export { homeLoader };
