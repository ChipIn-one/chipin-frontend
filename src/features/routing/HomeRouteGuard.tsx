import { Navigate } from 'react-router-dom';

import { userSoloModeByDefault } from 'entities/users';
import { getPreferredModeRoute } from 'helpers/routes';
import { useCanAccessSolo, useUserSetting } from 'hooks/useSelfUser';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { GuardLoader } from './internal';

interface Props {
    children: React.ReactNode;
}

const HomeRouteGuard = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const soloModeByDefault = useUserSetting(userSoloModeByDefault);
    const canAccessSolo = useCanAccessSolo();
    const isUserFetched = useLoadingStore(selectUserSelfFetched);

    if (!isAuthResolved || (isLoggedIn && !isUserFetched)) {
        return <GuardLoader />;
    }

    if (isLoggedIn) {
        return <Navigate to={getPreferredModeRoute(canAccessSolo && soloModeByDefault)} replace />;
    }

    return <>{children}</>;
};

export default HomeRouteGuard;
