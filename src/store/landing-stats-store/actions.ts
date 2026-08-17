import { create } from 'zustand';

import * as statsApi from 'api/statsApi';

import { useLoadingStore } from '../loadingStore';

import { initialState } from './initialState';
import type { LandingStatsStore } from './types';

const useLandingStatsStore = create<LandingStatsStore>((set, get) => ({
    ...initialState,
    fetchSetStats: () => {
        const { landing, setLoading } = useLoadingStore.getState();

        if (get().stats !== null || landing.stats !== 'initial') {
            return Promise.resolve();
        }

        setLoading('landing', 'stats', 'loading');

        return statsApi
            .fetchStats()
            .then(nextStats => {
                set({ stats: nextStats });
            })
            .catch(() => {
                set({ stats: null });
            })
            .finally(() => {
                setLoading('landing', 'stats', 'fetched');
            });
    },
    setInitialLandingStatsStore: () => {
        set(initialState);
        useLoadingStore.getState().setLoading('landing', 'stats', 'initial');
    },
}));

export { useLandingStatsStore };
