import { Navigate } from 'react-router-dom';

import { userSoloModeByDefault } from 'entities/users';
import { getPreferredModeRoute } from 'helpers/routes';
import { useCanAccessSolo, useSelfUserState, useUserSetting } from 'hooks/useSelfUser';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { GuardLoader } from './internal';

interface Props {
    children: React.ReactNode;
}

const HomeRouteGuard = ({ children }: Props) => {
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

export default HomeRouteGuard;
