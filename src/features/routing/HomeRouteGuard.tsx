import { Navigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';

interface Props {
    children: React.ReactNode;
}

const HomeRouteGuard = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    if (!isAuthResolved) {
        return <PageLoader />;
    }

    if (isLoggedIn) {
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    return <>{children}</>;
};

export default HomeRouteGuard;
