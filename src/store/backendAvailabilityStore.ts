import { create } from 'zustand';

import { checkBackendHealth } from 'api/healthApi';

export interface BackendAvailabilityStore {
    isUnavailable: boolean;
    setUnavailable: () => void;
    clearUnavailable: () => void;
    retryBackendHealth: () => Promise<void>;
}

export const useBackendAvailabilityStore = create<BackendAvailabilityStore>(set => ({
    isUnavailable: false,
    setUnavailable: () => {
        set({ isUnavailable: true });
    },
    clearUnavailable: () => {
        set({ isUnavailable: false });
    },
    retryBackendHealth: () => {
        return checkBackendHealth().then(() => {
            set({ isUnavailable: false });
        });
    },
}));
