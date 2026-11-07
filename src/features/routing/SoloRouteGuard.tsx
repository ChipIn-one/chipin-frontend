import { Navigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useCanAccessSolo, useSelfUserState } from 'hooks/useSelfUser';

import PageLoader from 'basics/PageLoader';

interface Props {
    children: React.ReactNode;
}

const SoloRouteGuard = ({ children }: Props) => {
    const isUserFetched = useSelfUserState().isFetched;
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
