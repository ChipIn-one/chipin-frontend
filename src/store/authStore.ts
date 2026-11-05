import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import {
    AuthSessionExpiredError,
    AuthSessionPersistenceError,
    clearExpiredAuthSession,
    establishAuthSession,
    invalidateAuthSession,
    logoutOtherDevicesSession,
    startAuthLogout,
    validateAuthSession,
} from 'helpers/authSession';
import { isUnauthorizedApiError, normalizeApiError } from 'helpers/errors';
import { clearLocalUserIdentity, clearLocalUserRole } from 'helpers/localStorage';

import { useActivityStore } from './activity-store';
import { AUTH_STATUS, type AuthStatus, UNAUTH_REASON, type UnauthReason } from './authConstants';
import { useDashboardStore } from './dashboardStore';
import { useErrorsStore } from './errorsStore';
import { useExpenseModalStore } from './expenseModalStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

export interface AuthStore {
    status: AuthStatus;
    unauthReason?: UnauthReason;
    isNewUser: boolean | null;

    setAuthenticated: () => void;
    setUnauthenticated: (reason: UnauthReason) => void;
    expireSession: () => void;
    exchangeGoogleOAuthCode: (code: string) => Promise<void>;
    refreshAuthTokens: () => Promise<string>;
    logoutOtherDevices: () => Promise<void>;
    signOut: () => Promise<void>;
}

let signOutPromise: Promise<void> | null = null;
let lastOAuthExchange: { code: string; promise: Promise<void> } | null = null;

// `signedOut`: a sign-out (this tab or remote) also drops the cached user `id` (spec 03 §1.5);
// any other reason (expiry, missing, error) keeps it with the user's cache.
const resetAuthScopedStores = (signedOut = false) => {
    // Before setInitialUsersStore(), which re-reads the cached user from localStorage.
    if (signedOut) {
        // A later sign-in with the same code must reach the server, not this session's result.
        lastOAuthExchange = null;
        clearLocalUserIdentity();
    } else {
        clearLocalUserRole();
    }
    useActivityStore.getState().resetActivity();
    useDashboardStore.getState().setInitialDashboardStore();
    useExpenseModalStore.getState().reset();
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.getState().setInitialUsersStore();
    useLoadingStore.getState().setInitialLoadingStore();
};

export const useAuthStore = create<AuthStore>(set => ({
    status: AUTH_STATUS.UNKNOWN,
    unauthReason: undefined,
    isNewUser: null,

    setAuthenticated: () => {
        set({ status: AUTH_STATUS.AUTHENTICATED, unauthReason: undefined });
    },

    setUnauthenticated: reason => {
        resetAuthScopedStores(reason === UNAUTH_REASON.SIGNED_OUT);
        set({ status: AUTH_STATUS.UNAUTHENTICATED, unauthReason: reason, isNewUser: null });
    },

    expireSession: () => {
        invalidateAuthSession();
        resetAuthScopedStores();
        set({
            status: AUTH_STATUS.UNAUTHENTICATED,
            unauthReason: UNAUTH_REASON.EXPIRED,
            isNewUser: null,
        });
    },

    exchangeGoogleOAuthCode: code => {
        // An OAuth code is single-use. The first `LocalUser.id` written during the exchange
        // (`fetchSetUser`) remounts the app on the user's QueryClient (spec 03 §1.5), and the
        // remounted callback page asks again: it gets this exchange, not a second request.
        if (lastOAuthExchange?.code === code) {
            return lastOAuthExchange.promise;
        }
        useErrorsStore.getState().clearError('auth', 'login');
        const promise = exchangeApiGoogleOAuthCode(code)
            .then(({ token, is_new_user: isNewUser }) => {
                establishAuthSession(token);
                set({ status: AUTH_STATUS.AUTHENTICATED, unauthReason: undefined, isNewUser });

                const { fetchSetDashboardData, setDefaultAppMode } = useDashboardStore.getState();
                const { fetchSetGroups } = useGroupsStore.getState();
                const { fetchSetPremiumPromoRemaining, fetchSetUser, fetchSetFriends } =
                    useUsersStore.getState();

                return Promise.all([
                    fetchSetDashboardData(),
                    fetchSetGroups(),
                    fetchSetUser().then(user => {
                        if (user) {
                            setDefaultAppMode(user.settings.soloModeByDefault);
                        }
                    }),
                    fetchSetFriends(),
                    isNewUser ? fetchSetPremiumPromoRemaining() : Promise.resolve(),
                ]).then(() => undefined);
            })
            .catch((error: unknown) => {
                const cleanup =
                    error instanceof AuthSessionPersistenceError
                        ? startAuthLogout()
                        : Promise.resolve();

                return cleanup.then(() => {
                    resetAuthScopedStores();
                    set({
                        status: AUTH_STATUS.UNAUTHENTICATED,
                        unauthReason:
                            error instanceof AuthSessionPersistenceError
                                ? UNAUTH_REASON.PERSISTENCE_ERROR
                                : UNAUTH_REASON.ERROR,
                        isNewUser: null,
                    });
                    useErrorsStore.getState().setError('auth', 'login', normalizeApiError(error));
                    return Promise.reject(error);
                });
            });

        lastOAuthExchange = { code, promise };
        // A failed exchange is not cached: a retry sends a new request.
        promise.catch(() => {
            if (lastOAuthExchange?.promise === promise) {
                lastOAuthExchange = null;
            }
        });
        return promise;
    },

    refreshAuthTokens: () => {
        return validateAuthSession().then(nextAccessToken => {
            if (!nextAccessToken) {
                useAuthStore.getState().expireSession();
                return Promise.reject(new Error('Auth session is missing or expired'));
            }

            set({ status: AUTH_STATUS.AUTHENTICATED, unauthReason: undefined });
            return nextAccessToken;
        });
    },

    logoutOtherDevices: () => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        clearError('auth', 'logoutOtherDevices');
        setLoading('auth', 'logoutOtherDevices', 'loading');

        return logoutOtherDevicesSession()
            .catch((error: unknown) => {
                setError('auth', 'logoutOtherDevices', normalizeApiError(error));
                if (!isUnauthorizedApiError(error) && !(error instanceof AuthSessionExpiredError)) {
                    return Promise.reject(error);
                }

                return clearExpiredAuthSession().then(() => {
                    useAuthStore.getState().setUnauthenticated(UNAUTH_REASON.EXPIRED);
                    return Promise.reject(error);
                });
            })
            .finally(() => {
                setLoading('auth', 'logoutOtherDevices', 'fetched');
            });
    },

    signOut: () => {
        if (signOutPromise) {
            return signOutPromise;
        }

        // Start the best-effort server logout, but leave protected UI immediately.
        const logoutRequest = startAuthLogout();
        resetAuthScopedStores(true);
        set({
            status: AUTH_STATUS.UNAUTHENTICATED,
            unauthReason: UNAUTH_REASON.SIGNED_OUT,
            isNewUser: null,
        });

        signOutPromise = logoutRequest.finally(() => {
            signOutPromise = null;
        });
        return signOutPromise;
    },
}));
