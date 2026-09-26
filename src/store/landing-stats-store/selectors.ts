import type { LandingStatsStore } from './types';

const selectLandingStats = (state: LandingStatsStore) => state.stats;

export { selectLandingStats };
