import { create } from 'zustand';

import type { AppEvent } from 'api/activity.types';
import { fetchApiCurrencyRates, fetchApiDashboard } from 'api/chipin';
import { ApiCurrencyRatesResponse, BalanceEntry, BalancesMap } from 'api/chipin.raw.types';
import { sortBalancesByCurrency } from 'helpers/currencies';

import { calcBalancesSummary } from './commonSelectors';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { selectUserCurrency } from './usersSelectors';
import { useUsersStore } from './usersStore';

export interface DashboardStore {
    fetchSetDashboardData: () => void;
    setDashboardSummaryCurrency: (defaultCurrency: string) => void;
    setInitialDashboardStore: () => void;

    balances: BalancesMap;
    owedEntries: BalanceEntry[];
    oweEntries: BalanceEntry[];
    netTotalInBase: number | null;
    owedTotalInBase: number | null;
    owingTotalInBase: number | null;

    activityItems: AppEvent[];
    activityNextCursor: number | null;

    currencies: ApiCurrencyRatesResponse;
}

const initialDashboardStore = {
    balances: {},
    owedEntries: [],
    oweEntries: [],
    netTotalInBase: null,
    owedTotalInBase: null,
    owingTotalInBase: null,

    activityItems: [],
    activityNextCursor: null,

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

                const defaultCurrency = selectUserCurrency(useUsersStore.getState());
                const entries = Object.values(dashboard.balances);
                const { netTotalInBase, owedTotalInBase, owingTotalInBase } = calcBalancesSummary(
                    defaultCurrency,
                    currencies.rates,
                    currencies.base,
                    {
                        balances: dashboard.balances,
                    },
                );
                const owedEntries = sortBalancesByCurrency(
                    entries.filter(entry => entry.netBalance > 0),
                    currencies.rates,
                    currencies.base,
                    defaultCurrency,
                );
                const oweEntries = sortBalancesByCurrency(
                    entries.filter(entry => entry.netBalance < 0),
                    currencies.rates,
                    currencies.base,
                    defaultCurrency,
                );

                set({
                    balances: dashboard.balances,
                    owedEntries,
                    oweEntries,
                    netTotalInBase,
                    owedTotalInBase,
                    owingTotalInBase,
                    activityItems: dashboard.activity.items,
                    activityNextCursor: dashboard.activity.nextCursor,
                    currencies,
                });
                setLoading('dashboard', 'data', 'fetched');
            })
            .catch(error => {
                console.error('Error fetching dashboard data:', error);
                setLoading('dashboard', 'data', 'fetched');
            });
    },
    setDashboardSummaryCurrency: defaultCurrency => {
        set(state => {
            const entries = Object.values(state.balances);
            const { netTotalInBase, owedTotalInBase, owingTotalInBase } = calcBalancesSummary(
                defaultCurrency,
                state.currencies.rates,
                state.currencies.base,
                {
                    balances: state.balances,
                },
            );

            return {
                netTotalInBase,
                owedTotalInBase,
                owingTotalInBase,
                owedEntries: sortBalancesByCurrency(
                    entries.filter(entry => entry.netBalance > 0),
                    state.currencies.rates,
                    state.currencies.base,
                    defaultCurrency,
                ),
                oweEntries: sortBalancesByCurrency(
                    entries.filter(entry => entry.netBalance < 0),
                    state.currencies.rates,
                    state.currencies.base,
                    defaultCurrency,
                ),
            };
        });
    },
    setInitialDashboardStore: () => {
        set(initialDashboardStore);
    },
}));
