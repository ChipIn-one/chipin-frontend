import { Box } from '@radix-ui/themes';
import { Navigate, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { getLastAccountLandingPath } from 'helpers/publicRoutes';
import { UNAUTH_REASON } from 'store/authConstants';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { AuthModal } from 'components/modals/auth-modal';

import { GuardLoader } from './internal';

interface Props {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
    const navigate = useNavigate();
    const { isAuthResolved, isLoggedIn, unauthReason } = useAuthStore(
        useShallow(state => ({
            isAuthResolved: selectIsAuthResolved(state),
            isLoggedIn: selectIsLoggedIn(state),
            unauthReason: state.unauthReason,
        })),
    );

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
