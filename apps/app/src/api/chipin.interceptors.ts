// The legacy entry of the interceptors, which live in `shared/api/interceptors.ts`: it wires them
// to `helpers/authSession`, which `shared-api` cannot import.
import {
    getAccessTokenSubject,
    getAuthSessionVersion,
    hasAuthAccessTokenRotated,
    isAuthSessionCurrent,
    isAuthSessionSignedOut,
    isAuthSessionSwitchedSince,
    prepareAuthRequest,
    refreshAuthSession,
} from 'helpers/authSession';
import { initChipInApiInterceptors as initSharedChipInApiInterceptors } from 'shared/api/interceptors';

export {
    AuthRequestCancelledError,
    EXPECTED_TOKEN_SUBJECT_CONFIG_KEY,
} from 'shared/api/interceptors';

/** Installs the interceptors once over `helpers/authSession`; see `shared/api/interceptors.ts`. */
export const initChipInApiInterceptors = (
    onUnauthorizedSessionCallback?: () => void,
    onRequestFailureCallback?: (error: unknown, requestStartedAt?: number) => Promise<void>,
    onResponseSuccessCallback?: (requestStartedAt?: number) => void,
    onAccessTokenChangedCallback?: (token: string) => void,
    onClientOutdatedCallback?: () => void,
): void => {
    initSharedChipInApiInterceptors(
        {
            getAccessTokenSubject,
            getAuthSessionVersion,
            hasAuthAccessTokenRotated,
            isAuthSessionCurrent,
            isAuthSessionSignedOut,
            isAuthSessionSwitchedSince,
            prepareAuthRequest,
            refreshAuthSession,
        },
        onUnauthorizedSessionCallback,
        onRequestFailureCallback,
        onResponseSuccessCallback,
        onAccessTokenChangedCallback,
        onClientOutdatedCallback,
    );
};
