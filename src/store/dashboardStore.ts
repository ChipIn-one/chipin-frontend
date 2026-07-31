import { create } from 'zustand';

import type { AppEvent } from 'api/activity.types';
import { fetchApiCurrencyRates, fetchApiDashboard } from 'api/chipin';
import type { ApiCurrencyRatesResponse, BalanceEntry, BalancesMap } from 'api/chipin.raw.types';
import { sortBalancesByCurrency } from 'helpers/currencies';
import { getLocalUser } from 'helpers/localStorage';

import { calcBalancesSummary } from './commonSelectors';
import { useLoadingStore } from './loadingStore';
import { selectUserCurrency } from './users-store';
import { useUsersStore } from './users-store';

const APP_MODES = {
    GROUP: 'group',
    SOLO: 'solo',
} as const;

type AppMode = (typeof APP_MODES)[keyof typeof APP_MODES];

interface DashboardStoreState {
    appMode: AppMode;
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

export interface DashboardStore extends DashboardStoreState {
    fetchSetDashboardData: () => void;
    setAppMode: (appMode: AppMode) => void;
    setDefaultAppMode: (isSoloModeByDefault: boolean) => void;
    setDashboardSummaryCurrency: (defaultCurrency: string) => void;
    setInitialDashboardStore: () => void;
}

const getDefaultAppMode = (isSoloModeByDefault: boolean): AppMode => {
    return isSoloModeByDefault ? APP_MODES.SOLO : APP_MODES.GROUP;
};

const createInitialDashboardState = (): DashboardStoreState => {
    const localUser = getLocalUser();

    return {
        appMode: getDefaultAppMode(localUser?.settings?.soloModeByDefault ?? false),
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
};

export const useDashboardStore = create<DashboardStore>(set => ({
    ...createInitialDashboardState(),

    fetchSetDashboardData: () => {
        const { setLoading } = useLoadingStore.getState();

        setLoading('dashboard', 'data', 'loading');

        Promise.all([fetchApiDashboard(), fetchApiCurrencyRates()])
            .then(([dashboard, currencies]) => {
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
    setAppMode: appMode => {
        set({ appMode });
    },
    setDefaultAppMode: isSoloModeByDefault => {
        set({ appMode: getDefaultAppMode(isSoloModeByDefault) });
    },
    setInitialDashboardStore: () => {
        set(createInitialDashboardState());
    },
}));

export { APP_MODES, type AppMode };
