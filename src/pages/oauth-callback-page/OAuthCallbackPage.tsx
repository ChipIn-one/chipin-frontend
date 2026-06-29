import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { resolveApiErrorMessage } from 'helpers/errors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';

const resolveReturnTo = (returnTo: string | null): string => {
    if (!returnTo) {
        return ROUTES.DASHBOARD;
    }

    try {
        const url = new URL(returnTo, window.location.origin);

        if (url.origin !== window.location.origin || url.pathname === ROUTES.OAUTH_CALLBACK) {
            return ROUTES.DASHBOARD;
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return ROUTES.DASHBOARD;
    }
};

export const OAuthCallbackPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasStartedExchange = useRef(false);
    const exchangeGoogleOAuthCode = useAuthStore(s => s.exchangeGoogleOAuthCode);
    const setUnauthenticated = useAuthStore(s => s.setUnauthenticated);

    useEffect(() => {
        if (hasStartedExchange.current) {
            return;
        }

        hasStartedExchange.current = true;

        const code = searchParams.get('code')?.trim();
        const returnTo = resolveReturnTo(searchParams.get('returnTo'));

        if (!code) {
            setUnauthenticated('error');
            toast.error(resolveApiErrorMessage(undefined, 'oauth.missing_code'));
            navigate(ROUTES.SIGN_IN, { replace: true });
            return;
        }

        exchangeGoogleOAuthCode(code)
            .then(() => {
                navigate(returnTo, { replace: true });
            })
            .catch(() => {
                navigate(ROUTES.SIGN_IN, { replace: true });
            });
    }, [exchangeGoogleOAuthCode, navigate, searchParams, setUnauthenticated]);

    return <PageLoader />;
};
