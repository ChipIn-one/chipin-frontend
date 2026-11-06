import { Navigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useCanAccessSolo } from 'hooks/useSelfUser';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import PageLoader from 'basics/PageLoader';

interface Props {
    children: React.ReactNode;
}

const SoloRouteGuard = ({ children }: Props) => {
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const canAccessSolo = useCanAccessSolo();

    if (!isUserFetched) {
        return <PageLoader />;
    }

    if (!canAccessSolo) {
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    return <>{children}</>;
};

export default SoloRouteGuard;
