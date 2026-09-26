import { Navigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, useUsersStore } from 'store/users-store';

import PageLoader from 'basics/PageLoader';

interface Props {
    children: React.ReactNode;
}

const SoloRouteGuard = ({ children }: Props) => {
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const canAccessSolo = useUsersStore(selectCanAccessSolo);

    if (!isUserFetched) {
        return <PageLoader />;
    }

    if (!canAccessSolo) {
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    return <>{children}</>;
};

export default SoloRouteGuard;
