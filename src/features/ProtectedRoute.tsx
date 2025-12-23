import { Box } from '@radix-ui/themes';

import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';
import SignInPage from 'pages/SignInPage';

interface Props {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    if (!isAuthResolved) {
        return <PageLoader />;
    }

    if (!isLoggedIn) {
        return <SignInPage />;
    }

    return (
        <Box pt="8" pb="8">
            {children}
        </Box>
    );
};
