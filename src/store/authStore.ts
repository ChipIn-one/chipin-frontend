import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';

import { deleteAuthTokensDB, saveAuthTokensDB } from './IDB/auth';
import { useDashboardStore } from './dashboardStore';
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
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>(set => ({
    status: 'unknown',
    unauthReason: undefined,
    isNewUser: null,

    setAuthenticated: () => {
        set({ status: 'authenticated', unauthReason: undefined });
    },

    setUnauthenticated: reason => {
        set({ status: 'unauthenticated', unauthReason: reason, isNewUser: null });
    },

    exchangeGoogleOAuthCode: async code => {
        try {
            const {
                token,
                refresh_token: refreshToken,
                is_new_user: isNewUser,
            } = await exchangeApiGoogleOAuthCode(code);
            await saveAuthTokensDB({ accessToken: token, refreshToken });
            set({ status: 'authenticated', unauthReason: undefined, isNewUser });

            const { fetchSetDashboardData } = useDashboardStore.getState();
            const { fetchSetUser, fetchSetFriends } = useUsersStore.getState();

            fetchSetDashboardData();
            fetchSetUser();
            fetchSetFriends();
        } catch (error: unknown) {
            set({ status: 'unauthenticated', unauthReason: 'error', isNewUser: null });
            throw error;
        }
    },

    signOut: async () => {
        await deleteAuthTokensDB();
        set({ status: 'unauthenticated', unauthReason: 'signed_out', isNewUser: null });
    },
}));
