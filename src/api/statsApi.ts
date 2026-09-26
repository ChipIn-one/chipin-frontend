import { publicApiInstance } from './chipin.instance';
import type { ApiStatsResponse } from './stats.types';

const fetchStats = (): Promise<ApiStatsResponse> => {
    return publicApiInstance.get<ApiStatsResponse>('/stats').then(response => response.data);
};

export { fetchStats };
