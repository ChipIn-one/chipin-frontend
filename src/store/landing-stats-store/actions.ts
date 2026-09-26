import { create } from 'zustand';

import * as statsApi from 'api/statsApi';
import { normalizeApiError } from 'helpers/errors';

import { useErrorsStore } from '../errorsStore';
import { useLoadingStore } from '../loadingStore';

import { initialState } from './initialState';
import type { LandingStatsStore } from './types';

const useLandingStatsStore = create<LandingStatsStore>((set, get) => ({
    ...initialState,
    fetchSetStats: () => {
        const { landing, setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        if (get().stats !== null || landing.stats !== 'initial') {
            return Promise.resolve();
        }

        clearError('landing', 'stats');
        setLoading('landing', 'stats', 'loading');

        return statsApi
            .fetchStats()
            .then(nextStats => {
                set({ stats: nextStats });
            })
            .catch((error: unknown) => {
                set({ stats: null });
                setError('landing', 'stats', normalizeApiError(error));
            })
            .finally(() => {
                setLoading('landing', 'stats', 'fetched');
            });
    },
    setInitialLandingStatsStore: () => {
        const { clearError } = useErrorsStore.getState();
        set(initialState);
        useLoadingStore.getState().setLoading('landing', 'stats', 'initial');
        clearError('landing', 'stats');
    },
}));

export { useLandingStatsStore };
