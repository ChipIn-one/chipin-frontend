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

type RequestState =
    | { status: 'ready' | 'joining' | 'invalid' }
    | { status: 'error'; errorMessage: string };

export const useInviteConfirmation = <TResult>({
    inviteToken,
    errorFallbackMessage,
    onAccept,
    onAccepted,
}: Params<TResult>): InviteConfirmationState => {
    const navigate = useNavigate();
    const [requestState, setRequestState] = useState<RequestState>({ status: 'ready' });
    const isRequestInFlight = useRef(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
        };
    }, []);

    const isTokenValid = isInviteToken(inviteToken);

    const confirm = useCallback(() => {
        if (!isInviteToken(inviteToken) || isRequestInFlight.current) {
            return;
        }

        isRequestInFlight.current = true;
        const authSessionVersion = getAuthSessionVersion();
        const isCurrent = () => isMounted.current && isAuthSessionCurrent(authSessionVersion);

        setRequestState({ status: 'joining' });

        onAccept(inviteToken)
            .then(result => {
                if (!isCurrent()) {
                    return;
                }

                onAccepted(result);
            })
            .catch((error: unknown) => {
                if (!isCurrent()) {
                    return;
                }

                setRequestState(getApiErrorStatus(error) === 404
                    ? { status: 'invalid' }
                    : {
                        status: 'error',
                        errorMessage: resolveApiErrorMessageFromError(error, errorFallbackMessage),
                    });
            })
            .finally(() => {
                isRequestInFlight.current = false;
            });
    }, [errorFallbackMessage, inviteToken, onAccept, onAccepted]);

    const cancel = useCallback(() => {
        navigate(ROUTES.DASHBOARD, { replace: true });
    }, [navigate]);

    if (!isTokenValid) {
        return { status: 'invalid', confirm, cancel };
    }

    return requestState.status === 'error'
        ? { status: 'error', errorMessage: requestState.errorMessage, confirm, cancel }
        : { status: requestState.status, confirm, cancel };
};
