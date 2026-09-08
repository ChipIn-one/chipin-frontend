import type { LandingStats } from 'api/stats.types';

interface LandingStatsStoreState {
    stats: LandingStats | null;
}

interface LandingStatsStoreActions {
    fetchSetStats: () => Promise<void>;
    setInitialLandingStatsStore: () => void;
}

type LandingStatsStore = LandingStatsStoreState & LandingStatsStoreActions;

export type {
    LandingStatsStore,
    LandingStatsStoreActions,
    LandingStatsStoreState,
};
