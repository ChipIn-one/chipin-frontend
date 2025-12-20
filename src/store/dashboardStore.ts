import { create } from 'zustand';

import { fetchApiDashboard } from 'api/chipin';

import { useGroupsStore } from './groupsStore';

interface DashboardStore {
    isLoadingDashboard: boolean;
    fetchSetDashboardData: () => void;
}

const initialDashboardStore = {
    isLoadingDashboard: false,
};

export const useDashboardStore = create<DashboardStore>(set => ({
    ...initialDashboardStore,

    fetchSetDashboardData: () => {
        const { setGroups } = useGroupsStore.getState();
        set({ isLoadingDashboard: true });

        fetchApiDashboard()
            .then(data => {
                setGroups(data.groups);
            })
            .catch(error => {
                console.error('Error fetching dashboard data:', error);
            })
            .finally(() => {
                set({ isLoadingDashboard: false });
            });
    },
}));
