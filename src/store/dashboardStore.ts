import { ApiGroup } from 'types/api';
import { create } from 'zustand';

import { fetchApiDashboard } from 'api/chipin';

interface DashboardStore {
    isLoadingDashboard: boolean;
    dashboardGroups: ApiGroup[];
    fetchSetDashboardData: () => void;
}

const initialDashboardStore = {
    isLoadingDashboard: false,

    dashboardGroups: [],
};

export const useDashboardStore = create<DashboardStore>(set => ({
    ...initialDashboardStore,

    fetchSetDashboardData: () => {
        set({ isLoadingDashboard: true });

        fetchApiDashboard()
            .then(data => {
                set({
                    dashboardGroups: data.groups,
                });
            })
            .catch(error => {
                console.error('Error fetching dashboard data:', error);
            })
            .finally(() => {
                set({ isLoadingDashboard: false });
            });
    },
}));
