import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import {
    AuthTokenPersistenceError,
    clearExpiredAuthSession,
    establishAuthSession,
    invalidateAuthSession,
    logoutOtherDevicesSession,
    startAuthLogout,
    validateAuthSession,
} from 'helpers/authSession';
import { isNetworkApiError, isUnauthorizedApiError, normalizeApiError } from 'helpers/errors';
import { getAuthTokens } from 'helpers/localStorage';

import { useActivityStore } from './activity-store';
import { useDashboardStore } from './dashboardStore';
import { useErrorsStore } from './errorsStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';
export type UnauthReason =
    | 'missing'
    | 'expired'
    | 'invalid'
    | 'signed_out'
    | 'error'
    | 'persistence_error';

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

const resetAuthScopedStores = () => {
    useActivityStore.getState().resetActivity();
    useDashboardStore.getState().setInitialDashboardStore();
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.getState().setInitialUsersStore();
    useLoadingStore.getState().setInitialLoadingStore();
};

export const useAuthStore = create<AuthStore>(set => ({
    status: 'unknown',
    unauthReason: undefined,
    isNewUser: null,

    setAuthenticated: () => {
        set({ status: 'authenticated', unauthReason: undefined });
    },

    setUnauthenticated: reason => {
        resetAuthScopedStores();
        set({ status: 'unauthenticated', unauthReason: reason, isNewUser: null });
    },

    expireSession: () => {
        invalidateAuthSession();
        resetAuthScopedStores();
        set({ status: 'unauthenticated', unauthReason: 'expired', isNewUser: null });
    },

    exchangeGoogleOAuthCode: code => {
        useErrorsStore.getState().clearError('auth', 'login');
        return exchangeApiGoogleOAuthCode(code)
            .then(({ token, refresh_token: refreshToken, is_new_user: isNewUser }) => {
                establishAuthSession({ accessToken: token, refreshToken });
                set({ status: 'authenticated', unauthReason: undefined, isNewUser });

                const { fetchSetDashboardData, setDefaultAppMode } =
                    useDashboardStore.getState();
                const { fetchSetGroups } = useGroupsStore.getState();
                const { fetchSetUser, fetchSetFriends } = useUsersStore.getState();

                return Promise.all([
                    fetchSetDashboardData(),
                    fetchSetGroups(),
                    fetchSetUser().then(user => {
                        if (user) {
                            setDefaultAppMode(user.settings.soloModeByDefault);
                        }
                    }),
                    fetchSetFriends(),
                ]).then(() => undefined);
            })
            .catch((error: unknown) => {
                resetAuthScopedStores();
                set({
                    status: 'unauthenticated',
                    unauthReason:
                        error instanceof AuthTokenPersistenceError
                            ? 'persistence_error'
                            : 'error',
                    isNewUser: null,
                });
                useErrorsStore.getState().setError('auth', 'login', normalizeApiError(error));
                return Promise.reject(error);
            });
    },

    refreshAuthTokens: () => {
        return validateAuthSession()
            .then(tokens => {
                if (!tokens) {
                    useAuthStore.getState().expireSession();
                    return Promise.reject(new Error('Auth tokens are missing'));
                }

                set({ status: 'authenticated', unauthReason: undefined });

                return tokens.accessToken;
            })
            .catch((error: unknown) => {
                if (error instanceof AuthTokenPersistenceError) {
                    useAuthStore.getState().expireSession();
                    return Promise.reject(error);
                }

                if (!isNetworkApiError(error)) {
                    return Promise.reject(error);
                }

                const cachedTokens = getAuthTokens();

                if (!cachedTokens) {
                    return Promise.reject(error);
                }

                set({ status: 'authenticated', unauthReason: undefined });
                return cachedTokens.accessToken;
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
                if (
                    !isUnauthorizedApiError(error) &&
                    !(error instanceof AuthTokenPersistenceError)
                ) {
                    return Promise.reject(error);
                }

                const reason =
                    error instanceof AuthTokenPersistenceError
                        ? 'persistence_error'
                        : 'expired';

                return clearExpiredAuthSession().then(() => {
                    useAuthStore.getState().setUnauthenticated(reason);
                    return Promise.reject(error);
                });
            })
            .finally(() => {
                setLoading('auth', 'logoutOtherDevices', 'fetched');
            });
    },

    signOut: () => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        clearError('auth', 'signOut');
        setLoading('auth', 'signOut', 'loading');

        return startAuthLogout()
            .then(() => {
                setLoading('auth', 'signOut', 'fetched');
                resetAuthScopedStores();
                set({ status: 'unauthenticated', unauthReason: 'signed_out', isNewUser: null });
            })
            .catch(error => {
                setLoading('auth', 'signOut', 'fetched');
                setError('auth', 'signOut', normalizeApiError(error));
                throw error;
            });
    },
}));
