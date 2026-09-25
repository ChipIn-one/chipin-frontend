import { Navigate, useNavigate } from 'react-router-dom';

import { Box } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';
import { AuthModal } from 'components/modals/auth-modal';

interface Props {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
    const navigate = useNavigate();
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const unauthReason = useAuthStore(state => state.unauthReason);

    if (!isAuthResolved) {
        return <PageLoader />;
    }

    if (!isLoggedIn) {
        if (unauthReason === 'signed_out') {
            return <Navigate to={ROUTES.HOME} replace />;
        }

        return (
            <AuthModal
                isOpened
                onOpenChange={isOpen => {
                    if (!isOpen) {
                        navigate(ROUTES.HOME, { replace: true });
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
