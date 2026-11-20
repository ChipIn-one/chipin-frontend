import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { userSoloModeByDefault } from 'entities/users';
import { GuardLoader } from 'features/routing';
import { getPreferredModeRoute } from 'helpers/routes';
import { useCanAccessSolo, useSelfUserState, useUserSetting } from 'hooks/useSelfUser';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

interface Props {
    children: ReactNode;
}

/**
 * Redirects a signed-in user from the transitional `publicHome` (spec 04 §2.2) to the preferred mode
 * (dashboard or Solo); a signed-out user sees the home page. Replaced by the `home` index loader in
 * 04-5a.
 */
const PublicHomeGuard = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const soloModeByDefault = useUserSetting(userSoloModeByDefault);
    const canAccessSolo = useCanAccessSolo();
    const isUserFetched = useSelfUserState().isFetched;

    if (!isAuthResolved || (isLoggedIn && !isUserFetched)) {
        return <GuardLoader />;
    }

    if (isLoggedIn) {
        return <Navigate to={getPreferredModeRoute(canAccessSolo && soloModeByDefault)} replace />;
    }

    return <>{children}</>;
};

export { PublicHomeGuard };
