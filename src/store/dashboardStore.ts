import { create } from 'zustand';

import * as activityApi from 'api/activityApi';
import * as chipinApi from 'api/chipin';
import type { ApiCurrencyRatesResponse } from 'api/chipin.raw.types';
import type { ActivityFeedItem, Dashboard } from 'api/chipin.types';
import { normalizeApiError } from 'helpers/errors';
import { getLocalUser } from 'helpers/localStorage';

import { ACTIVITY_API_LIMIT } from './activity-store/constants';
import { createRequestChannel } from './internal/resourceRequests';
import { useErrorsStore } from './errorsStore';
import { useLoadingStore } from './loadingStore';

const dashboardDataChannel = createRequestChannel();
const dashboardActivityPageChannel = createRequestChannel();
const currencyRatesChannel = createRequestChannel();

const APP_MODES = {
    GROUP: 'group',
    SOLO: 'solo',
} as const;

type AppMode = (typeof APP_MODES)[keyof typeof APP_MODES];

interface DashboardStoreState {
    appMode: AppMode;
    balances: Dashboard['balances'];
    activityItems: ActivityFeedItem[];
    activityNextCursor: number | null;
    currencies: ApiCurrencyRatesResponse;
}

export interface DashboardStore extends DashboardStoreState {
    fetchSetDashboardData: () => Promise<void>;
    fetchSetDashboard: (force?: boolean) => Promise<void>;
    fetchMoreDashboardActivity: () => Promise<void>;
    setAppMode: (appMode: AppMode) => void;
    setDefaultAppMode: (isSoloModeByDefault: boolean) => void;
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

export const useDashboardStore = create<DashboardStore>((set, get) => ({
    ...createInitialDashboardState(),

    fetchSetDashboardData: () => {
        const { clearError, setError } = useErrorsStore.getState();
        clearError('dashboard', 'data');
        const currenciesRequest = currencyRatesChannel.request(chipinApi.fetchApiCurrencyRates);

        return Promise.all([
            get().fetchSetDashboard(),
            currenciesRequest.promise
                .then(currencies => {
                    if (currenciesRequest.isCurrent()) {
                        set({ currencies });
                    }
                })
                .catch((error: unknown) => {
                    if (currenciesRequest.isCurrent()) {
                        setError('dashboard', 'data', normalizeApiError(error));
                    }
                }),
        ]).then(() => undefined);
    },
    fetchSetDashboard: (force = false) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        clearError('dashboard', 'data');

        if (force) {
            dashboardActivityPageChannel.abort();
            clearError('dashboard', 'nextPage');
        }

        const dashboardRequest = dashboardDataChannel.request(chipinApi.fetchApiDashboard, {
            force,
        });
        setLoading('dashboard', 'data', 'loading');
        setLoading('dashboard', 'nextPage', 'fetched');

        return dashboardRequest.promise
            .then(dashboard => {
                if (!dashboardRequest.isCurrent()) {
                    return;
                }

                set({
                    balances: dashboard.balances,
                    activityItems: dashboard.activity.items,
                    activityNextCursor: dashboard.activity.nextCursor,
                });
            })
            .catch((error: unknown) => {
                if (dashboardRequest.isCurrent()) {
                    setError('dashboard', 'data', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (dashboardRequest.isCurrent()) {
                    setLoading('dashboard', 'data', 'fetched');
                }
            });
    },
    fetchMoreDashboardActivity: () => {
        const { activityNextCursor } = get();
        const { dashboard, setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        if (activityNextCursor === null || dashboard.nextPage === 'loading') {
            return Promise.resolve();
        }

        clearError('dashboard', 'nextPage');
        setLoading('dashboard', 'nextPage', 'loading');
        const request = dashboardActivityPageChannel.request(
            signal =>
                activityApi.fetchActivityPreviews(
                    {
                        limit: ACTIVITY_API_LIMIT,
                        cursor: activityNextCursor,
                    },
                    signal,
                ),
            { identity: String(activityNextCursor) },
        );

        return request.promise
            .then(data => {
                if (!request.isCurrent()) {
                    return;
                }

                set(state => ({
                    activityItems: [...state.activityItems, ...data.items],
                    activityNextCursor: data.nextCursor,
                }));
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('dashboard', 'nextPage', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('dashboard', 'nextPage', 'fetched');
                }
            });
    },
    setAppMode: appMode => {
        set({ appMode });
    },
    setDefaultAppMode: isSoloModeByDefault => {
        set({ appMode: getDefaultAppMode(isSoloModeByDefault) });
    },
    setInitialDashboardStore: () => {
        dashboardDataChannel.abort();
        dashboardActivityPageChannel.abort();
        currencyRatesChannel.abort();
        set(createInitialDashboardState());
        useLoadingStore.getState().setLoading('dashboard', 'nextPage', 'fetched');
        useErrorsStore.getState().resetErrors();
    },
}));

export { APP_MODES, type AppMode };
