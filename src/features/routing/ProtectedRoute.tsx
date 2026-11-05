import { Box } from '@radix-ui/themes';
import { Navigate, useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { getLastAccountLandingPath } from 'helpers/publicRoutes';
import { UNAUTH_REASON } from 'store/authConstants';

import { AuthModal } from 'components/modals/auth-modal';

import { GuardLoader, useConnect } from './internal';

interface Props {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
    const navigate = useNavigate();
    const { isAuthResolved, isLoggedIn, unauthReason } = useConnect();

    if (!isAuthResolved) {
        return <GuardLoader />;
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
