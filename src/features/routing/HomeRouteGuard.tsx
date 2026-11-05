import { Navigate } from 'react-router-dom';

import { getPreferredModeRoute } from 'helpers/routes';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, selectUserSettings, useUsersStore } from 'store/users-store';

import PageLoader from 'basics/PageLoader';
import { OfflineBanner } from 'components/offline-banner';

interface Props {
    children: React.ReactNode;
}

const HomeRouteGuard = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const settings = useUsersStore(selectUserSettings);
    const canAccessSolo = useUsersStore(selectCanAccessSolo);
    const isUserFetched = useLoadingStore(selectUserSelfFetched);

    if (!isAuthResolved || (isLoggedIn && !isUserFetched)) {
        // An offline cold start waits here for the session check: say why instead of a bare loader.
        return (
            <>
                <OfflineBanner />
                <PageLoader />
            </>
        );
    }

    if (isLoggedIn) {
        return (
            <Navigate
                to={getPreferredModeRoute(canAccessSolo && (settings?.soloModeByDefault ?? false))}
                replace
            />
        );
    }

    return <>{children}</>;
};

export default HomeRouteGuard;
