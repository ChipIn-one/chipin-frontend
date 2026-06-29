import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import { clearExpiredAuthSession, getFreshAccessToken, startAuthLogout } from 'helpers/authSession';
import { saveAuthTokens } from 'helpers/localStorage';

import { useActivityStore } from './activityStore';
import { useDashboardStore } from './dashboardStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './usersStore';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';
export type UnauthReason = 'missing' | 'expired' | 'invalid' | 'signed_out' | 'error';

export interface AuthStore {
    status: AuthStatus;
    unauthReason?: UnauthReason;
    isNewUser: boolean | null;

    setAuthenticated: () => void;
    setUnauthenticated: (reason: UnauthReason) => void;
    exchangeGoogleOAuthCode: (code: string) => Promise<void>;
    refreshAuthTokens: () => Promise<string>;
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

    exchangeGoogleOAuthCode: async code => {
        try {
            const {
                token,
                refresh_token: refreshToken,
                is_new_user: isNewUser,
            } = await exchangeApiGoogleOAuthCode(code);
            saveAuthTokens({ accessToken: token, refreshToken });
            set({ status: 'authenticated', unauthReason: undefined, isNewUser });

            const { fetchSetDashboardData } = useDashboardStore.getState();
            const { fetchSetUser, fetchSetFriends } = useUsersStore.getState();

            fetchSetDashboardData();
            fetchSetUser();
            fetchSetFriends();
        } catch (error: unknown) {
            resetAuthScopedStores();
            set({ status: 'unauthenticated', unauthReason: 'error', isNewUser: null });
            throw error;
        }
    },

    refreshAuthTokens: () => {
        return getFreshAccessToken().then(accessToken => {
            if (!accessToken) {
                return clearExpiredAuthSession().then(() => {
                    resetAuthScopedStores();
                    set({ status: 'unauthenticated', unauthReason: 'expired', isNewUser: null });

                    return Promise.reject(new Error('Auth tokens are missing'));
                });
            }

            set({ status: 'authenticated', unauthReason: undefined });

            return accessToken;
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
