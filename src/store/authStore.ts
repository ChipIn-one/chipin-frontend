import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import {
    AuthTokenPersistenceError,
    clearExpiredAuthSession,
    invalidateAuthSession,
    logoutOtherDevicesSession,
    startAuthLogout,
    validateAuthSession,
} from 'helpers/authSession';
import { isNetworkApiError, isUnauthorizedApiError } from 'helpers/errors';
import { getAuthTokens, saveAuthTokens } from 'helpers/localStorage';

import { useActivityStore } from './activityStore';
import { useDashboardStore } from './dashboardStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './usersStore';

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
    useActivityStore.getState().setInitialActivityStore();
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
        return exchangeApiGoogleOAuthCode(code)
            .then(({ token, refresh_token: refreshToken, is_new_user: isNewUser }) => {
                saveAuthTokens({ accessToken: token, refreshToken });
                set({ status: 'authenticated', unauthReason: undefined, isNewUser });

                const { fetchSetDashboardData } = useDashboardStore.getState();
                const { fetchSetGroups } = useGroupsStore.getState();
                const { fetchSetUser, fetchSetFriends } = useUsersStore.getState();

                fetchSetDashboardData();
                fetchSetGroups().catch(() => undefined);
                fetchSetUser();
                fetchSetFriends();
            })
            .catch((error: unknown) => {
                resetAuthScopedStores();
                set({ status: 'unauthenticated', unauthReason: 'error', isNewUser: null });
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

        setLoading('auth', 'logoutOtherDevices', 'loading');

        return logoutOtherDevicesSession()
            .catch((error: unknown) => {
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

        setLoading('auth', 'signOut', 'loading');

        return startAuthLogout()
            .then(() => {
                setLoading('auth', 'signOut', 'fetched');
                resetAuthScopedStores();
                set({ status: 'unauthenticated', unauthReason: 'signed_out', isNewUser: null });
            })
            .catch(error => {
                setLoading('auth', 'signOut', 'fetched');
                throw error;
            });
    },
}));
