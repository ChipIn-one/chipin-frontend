import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import {
    resolveApiErrorMessage,
    resolveApiErrorMessageFromError,
} from 'helpers/errors';
import { resolveOAuthReturnTo } from 'helpers/url';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';

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
        const returnTo = resolveOAuthReturnTo(searchParams.get('returnTo'));

        if (!code) {
            setUnauthenticated('error');
            toast.error(resolveApiErrorMessage(undefined, 'oauth.missing_code'));
            navigate(returnTo, { replace: true });
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
                navigate(returnTo, { replace: true });
            });
    }, [exchangeGoogleOAuthCode, navigate, searchParams, setUnauthenticated, t]);

    return <PageLoader />;
};
