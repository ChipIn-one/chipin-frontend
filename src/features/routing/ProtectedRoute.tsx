import { Box } from '@radix-ui/themes';
import { Navigate, useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { getLastAccountLandingPath } from 'helpers/publicRoutes';
import { UNAUTH_REASON } from 'store/authConstants';

import PageLoader from 'basics/PageLoader';
import { AuthModal } from 'components/modals/auth-modal';
import { OfflineBanner } from 'components/offline-banner';

import { useConnect } from './internal';

interface Props {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
    const navigate = useNavigate();
    const { isAuthResolved, isLoggedIn, unauthReason } = useConnect();

    if (!isAuthResolved) {
        // An offline cold start waits here for the session check: say why instead of a bare loader.
        return (
            <>
                <OfflineBanner />
                <PageLoader />
            </>
        );
    }

    if (!isLoggedIn) {
        if (unauthReason === UNAUTH_REASON.SIGNED_OUT) {
            return <Navigate to={getLastAccountLandingPath()} replace />;
        }

        return (
            <AuthModal
                isOpened
                onOpenChange={isOpen => {
                    if (!isOpen) {
                        void navigate(ROUTES.HOME, { replace: true });
                    }
                }}
            />
        );
    }

    return (
        <Box pt={{ initial: '4', sm: '6' }} pb={{ initial: '4', sm: '6' }}>
            {children}
        </Box>
    );
};
