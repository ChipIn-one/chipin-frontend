import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { getApiErrorStatus, resolveApiErrorMessageFromError } from 'helpers/errors';
import { isInviteToken } from 'helpers/inviteToken';

export type InviteConfirmationStatus = 'invalid' | 'ready' | 'joining' | 'error';

export interface InviteConfirmationState {
    status: InviteConfirmationStatus;
    errorMessage?: string;
    confirm: () => void;
    cancel: () => void;
}

interface Params<TResult> {
    inviteToken: string | undefined;
    errorFallbackMessage: string;
    onAccept: (inviteToken: string) => Promise<TResult>;
    onAccepted: (result: TResult) => void;
}

type RequestState = { inviteToken: string } & (
    | { status: 'ready' | 'joining' | 'invalid' }
    | { status: 'error'; errorMessage: string }
);

export const useInviteConfirmation = <TResult>({
    inviteToken,
    errorFallbackMessage,
    onAccept,
    onAccepted,
}: Params<TResult>): InviteConfirmationState => {
    const navigate = useNavigate();
    const [requestState, setRequestState] = useState<RequestState | null>(null);
    const inFlightToken = useRef<string | null>(null);
    const currentToken = useRef(inviteToken);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        currentToken.current = inviteToken;
    }, [inviteToken]);

    const confirm = useCallback(() => {
        if (!isInviteToken(inviteToken) || inFlightToken.current === inviteToken) {
            return;
        }

        const token = inviteToken;
        inFlightToken.current = token;
        const authSessionVersion = getAuthSessionVersion();
        // A response for another invite (SPA navigation to a new token) or after unmount is dropped;
        // a response from a previous auth session only releases the loading state, never navigates.
        const isForCurrentPage = () => isMounted.current && currentToken.current === token;
        const isSessionCurrent = () => isAuthSessionCurrent(authSessionVersion);

        setRequestState({ inviteToken: token, status: 'joining' });

        onAccept(token)
            .then(result => {
                if (!isForCurrentPage()) {
                    return;
                }

                if (!isSessionCurrent()) {
                    setRequestState({ inviteToken: token, status: 'ready' });
                    return;
                }

                onAccepted(result);
            })
            .catch((error: unknown) => {
                if (!isForCurrentPage()) {
                    return;
                }

                if (!isSessionCurrent()) {
                    setRequestState({ inviteToken: token, status: 'ready' });
                    return;
                }

                setRequestState(getApiErrorStatus(error) === 404
                    ? { inviteToken: token, status: 'invalid' }
                    : {
                        inviteToken: token,
                        status: 'error',
                        errorMessage: resolveApiErrorMessageFromError(error, errorFallbackMessage),
                    });
            })
            .finally(() => {
                if (inFlightToken.current === token) {
                    inFlightToken.current = null;
                }
            });
    }, [errorFallbackMessage, inviteToken, onAccept, onAccepted]);

    const cancel = useCallback(() => {
        navigate(ROUTES.DASHBOARD, { replace: true });
    }, [navigate]);

    if (!isInviteToken(inviteToken)) {
        return { status: 'invalid', confirm, cancel };
    }

    // State recorded for a previous token does not leak into a newly opened invite.
    if (!requestState || requestState.inviteToken !== inviteToken) {
        return { status: 'ready', confirm, cancel };
    }

    return requestState.status === 'error'
        ? { status: 'error', errorMessage: requestState.errorMessage, confirm, cancel }
        : { status: requestState.status, confirm, cancel };
};
