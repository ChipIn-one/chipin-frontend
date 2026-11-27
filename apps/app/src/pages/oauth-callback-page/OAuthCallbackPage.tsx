import { useEffect, useRef } from 'react';
import { Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { resolveApiErrorMessage, resolveApiErrorMessageFromError } from 'helpers/errors';
import { loginPathFor, resolveOAuthReturnTo } from 'helpers/url';
import { isUnsentOpsConfirmOn } from 'hooks/unsentOpsConfirm';
import { useAuthStore } from 'store/authStore';

import { PageLoader } from 'basics/PageLoader';

import { AccountSwitchDialog } from './AccountSwitchDialog';

export const OAuthCallbackPage = () => {
    const { t } = useTranslation(['errors', 'auth']);
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
        const returnTo = resolveOAuthReturnTo(searchParams.get('returnTo'), window.location.origin);

        // A failed sign-in (no code: consent cancelled; a failed exchange) goes back to `/login`, which
        // keeps the validated `returnTo`, not to the protected page itself.
        if (!code) {
            setUnauthenticated('error');
            toast.error(resolveApiErrorMessage(undefined, 'oauth.missing_code'));
            void navigate(loginPathFor(returnTo), { replace: true });
            return;
        }

        exchangeGoogleOAuthCode(code)
            .then(() => {
                void navigate(returnTo, { replace: true });
            })
            .catch((error: unknown) => {
                toast.error(
                    resolveApiErrorMessageFromError(error, t('AUTH.INVALID_OAUTH_EXCHANGE_CODE')),
                );
                void navigate(loginPathFor(returnTo), { replace: true });
            });
    }, [exchangeGoogleOAuthCode, navigate, searchParams, setUnauthenticated, t]);

    const loader = (
        <PageLoader>
            <Text role="status" size="2" color="gray" align="center">
                {t('auth:signingIn')}
            </Text>
        </PageLoader>
    );

    // §1.5: the exchange may wait for the account-switch answer (offline writes on only).
    return isUnsentOpsConfirmOn() ? (
        <>
            {loader}
            <AccountSwitchDialog />
        </>
    ) : (
        loader
    );
};
