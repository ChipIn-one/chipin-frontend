import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import {
    resolveApiErrorMessage,
    resolveApiErrorMessageFromError,
} from 'helpers/errors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';

const resolveReturnTo = (returnTo: string | null): string => {
    if (!returnTo) {
        return ROUTES.HOME;
    }

    try {
        const url = new URL(returnTo, window.location.origin);

        if (url.origin !== window.location.origin || url.pathname === ROUTES.OAUTH_CALLBACK) {
            return ROUTES.HOME;
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return ROUTES.HOME;
    }
};

export const OAuthCallbackPage = () => {
    const { t } = useTranslation('errors');
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
            .catch((error: unknown) => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    t('AUTH.INVALID_OAUTH_EXCHANGE_CODE'),
                ));
                navigate(ROUTES.SIGN_IN, { replace: true });
            });
    }, [exchangeGoogleOAuthCode, navigate, searchParams, setUnauthenticated, t]);

    return <PageLoader />;
};
