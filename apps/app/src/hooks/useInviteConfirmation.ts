import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { getApiErrorStatus, resolveApiErrorMessageFromError } from 'helpers/errors';
import { isInviteToken } from 'helpers/inviteToken';

import { retrySessionLoad, useSessionSelfLoad } from './useSelfUser';

// `waiting`: the accept cannot be sent yet (the session is still being restored); confirming waits.
export type InviteConfirmationStatus = 'invalid' | 'waiting' | 'ready' | 'joining' | 'error';

export interface InviteConfirmationState {
    status: InviteConfirmationStatus;
    errorMessage?: string;
    confirm: () => void;
    cancel: () => void;
}

interface Params<TResult> {
    inviteToken: string | undefined;
    errorFallbackMessage: string;
    /** False until a write can be sent (`useIsUserWriteEnabled`): a confirm before it is ignored. */
    isAcceptEnabled: boolean;
    /** Shown when the session self load of a first sign-in failed, so a write never becomes possible. */
    sessionLoadErrorMessage: string;
    onAccept: (inviteToken: string) => Promise<TResult>;
    onAccepted: (result: TResult) => void;
}

type RequestState = { inviteToken: string } & (
    { status: 'ready' | 'joining' | 'invalid' } | { status: 'error'; errorMessage: string }
);

export const useInviteConfirmation = <TResult>({
    inviteToken,
    errorFallbackMessage,
    isAcceptEnabled,
    sessionLoadErrorMessage,
    onAccept,
    onAccepted,
}: Params<TResult>): InviteConfirmationState => {
    const navigate = useNavigate();
    const sessionLoad = useSessionSelfLoad();
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
        if (
            !isAcceptEnabled ||
            !isInviteToken(inviteToken) ||
            inFlightToken.current === inviteToken
        ) {
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

                setRequestState(
                    getApiErrorStatus(error) === 404
                        ? { inviteToken: token, status: 'invalid' }
                        : {
                              inviteToken: token,
                              status: 'error',
                              errorMessage: resolveApiErrorMessageFromError(
                                  error,
                                  errorFallbackMessage,
                              ),
                          },
                );
            })
            .finally(() => {
                if (inFlightToken.current === token) {
                    inFlightToken.current = null;
                }
            });
    }, [errorFallbackMessage, inviteToken, isAcceptEnabled, onAccept, onAccepted]);

    const cancel = useCallback(() => {
        void navigate(ROUTES.DASHBOARD, { replace: true });
    }, [navigate]);

    if (!isInviteToken(inviteToken)) {
        return { status: 'invalid', confirm, cancel };
    }

    // Before the session is restored the page runs on the anonymous client, where the accept would
    // be refused without a request (#730): the button waits instead of losing the click. A failed
    // self load of a first sign-in never remounts the page, so it is an error whose Retry runs the
    // load again (a success remounts the page onto the user's client).
    if (!isAcceptEnabled) {
        return sessionLoad.status === 'failed'
            ? {
                  status: 'error',
                  errorMessage: sessionLoadErrorMessage,
                  confirm: () => void retrySessionLoad(),
                  cancel,
              }
            : { status: 'waiting', confirm, cancel };
    }

    // State recorded for a previous token does not leak into a newly opened invite.
    if (!requestState || requestState.inviteToken !== inviteToken) {
        return { status: 'ready', confirm, cancel };
    }

    return requestState.status === 'error'
        ? { status: 'error', errorMessage: requestState.errorMessage, confirm, cancel }
        : { status: requestState.status, confirm, cancel };
};
