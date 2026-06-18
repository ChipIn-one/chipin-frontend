import { create } from 'zustand';

import { fetchApiCurrencyRates, fetchApiDashboard } from 'api/chipin';
import {
    ApiCurrencyRatesResponse,
    BalanceEntry,
    BalancesMap,
} from 'api/chipin.raw.types';

import { calcBalancesSummary } from './commonSelectors';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';

export interface DashboardStore {
    fetchSetDashboardData: () => void;

    balances: BalancesMap;
    owedEntries: BalanceEntry[];
    oweEntries: BalanceEntry[];
    netTotalInBase: number | null;
    owedTotalInBase: number | null;
    owingTotalInBase: number | null;

    currencies: ApiCurrencyRatesResponse;
}

const initialDashboardStore = {
    balances: {},
    owedEntries: [],
    oweEntries: [],
    netTotalInBase: null,
    owedTotalInBase: null,
    owingTotalInBase: null,

    currencies: {
        base: 'USD',
        timestamp: 0,
        fetchedAt: 0,
        stale: false,
        rates: {},
    },
};

export const useDashboardStore = create<DashboardStore>(set => ({
    ...initialDashboardStore,

    fetchSetDashboardData: () => {
        const { setGroups } = useGroupsStore.getState();
        const { setLoading } = useLoadingStore.getState();

        setLoading('dashboard', 'data', 'loading');

        Promise.all([fetchApiDashboard(), fetchApiCurrencyRates()])
            .then(([dashboard, currencies]) => {
                setGroups(dashboard.groups);

                const entries = Object.values(dashboard.balances);
                const { netTotalInBase, owedTotalInBase, owingTotalInBase } = calcBalancesSummary(
                    currencies.base,
                    currencies.rates,
                    {
                        balances: dashboard.balances,
                    },
                );

                set({
                    balances: dashboard.balances,
                    owedEntries: entries.filter(entry => entry.netBalance > 0),
                    oweEntries: entries.filter(entry => entry.netBalance < 0),
                    netTotalInBase,
                    owedTotalInBase,
                    owingTotalInBase,
                    currencies,
                });
                setLoading('dashboard', 'data', 'fetched');
            })
            .catch(error => {
                console.error('Error fetching dashboard data:', error);
                setLoading('dashboard', 'data', 'fetched');
            });
    },
}));
