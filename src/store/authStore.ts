import { create } from 'zustand';

import { deleteAuthTokenDB } from './IDB/auth';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';
export type UnauthReason = 'missing' | 'expired' | 'invalid' | 'signed_out' | 'error';

export interface AuthStore {
    status: AuthStatus;
    unauthReason?: UnauthReason;

    setAuthenticated: () => void;
    setUnauthenticated: (reason: UnauthReason) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>(set => ({
    status: 'unknown',
    unauthReason: undefined,

    setAuthenticated: () => {
        set({ status: 'authenticated', unauthReason: undefined });
    },

    setUnauthenticated: reason => {
        set({ status: 'unauthenticated', unauthReason: reason });
    },

    signOut: async () => {
        await deleteAuthTokenDB();
        set({ status: 'unauthenticated', unauthReason: 'signed_out' });
    },
}));
