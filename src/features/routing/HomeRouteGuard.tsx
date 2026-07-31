import { Navigate } from 'react-router-dom';

import { getPreferredModeRoute } from 'helpers/routes';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectUserSettings, useUsersStore } from 'store/users-store';

import PageLoader from 'basics/PageLoader';

interface Props {
    children: React.ReactNode;
}

const HomeRouteGuard = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const settings = useUsersStore(selectUserSettings);
    const isUserFetched = useLoadingStore(selectUserSelfFetched);

    if (!isAuthResolved || (isLoggedIn && !isUserFetched)) {
        return <PageLoader />;
    }

    if (isLoggedIn) {
        return (
            <Navigate
                to={getPreferredModeRoute(settings?.soloModeByDefault ?? false)}
                replace
            />
        );
    }

    return <>{children}</>;
};

export default HomeRouteGuard;
