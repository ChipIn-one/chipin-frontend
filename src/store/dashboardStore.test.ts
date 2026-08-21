import { beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import * as activityApi from 'api/activityApi';
import * as chipinApi from 'api/chipin';
import type { UserSettings } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';

import { APP_MODES, useDashboardStore } from './dashboardStore';
import { useErrorsStore } from './errorsStore';
import { useLoadingStore } from './loadingStore';

vi.mock('api/activityApi', () => ({
    fetchActivityPreviews: vi.fn(),
}));

vi.mock('api/chipin', () => ({
    fetchApiCurrencyRates: vi.fn(),
    fetchApiDashboard: vi.fn(),
}));

const balances = {
    USD: { currency: 'USD', netBalance: 25 },
};

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: true,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

beforeEach(() => {
    LocalStorage.clear();
    vi.clearAllMocks();
    useDashboardStore.getState().setInitialDashboardStore();
    useErrorsStore.getState().resetErrors();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('initializes the app mode from the cached default preference', () => {
    LocalStorage.set(LS_KEY_USER, { role: 'USER', settings });

    useDashboardStore.getState().setInitialDashboardStore();

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});

test('falls back to Group mode without a cached preference', () => {
    useDashboardStore.getState().setInitialDashboardStore();

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.GROUP);
});

test('changes the active app mode independently of the default preference', () => {
    useDashboardStore.getState().setAppMode(APP_MODES.SOLO);

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});

test('sets the app mode from a server default preference', () => {
    useDashboardStore.getState().setDefaultAppMode(true);

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});

test('stores dashboard balances as the canonical balance response', () => {
    vi.mocked(chipinApi.fetchApiDashboard).mockResolvedValue({
        balances,
        activity: { items: [], nextCursor: null },
    });

    return useDashboardStore.getState().fetchSetDashboard().then(() => {
        expect(useDashboardStore.getState()).toMatchObject({
            balances,
            activityItems: [],
            activityNextCursor: null,
        });
    });
});

test('preserves confirmed dashboard data when a refresh fails', () => {
    const confirmedBalances = balances;
    const requestError = new Error('Dashboard unavailable');
    useDashboardStore.setState({ balances: confirmedBalances });
    vi.mocked(chipinApi.fetchApiDashboard).mockRejectedValue(requestError);

    return useDashboardStore.getState().fetchSetDashboard().then(() => {
        expect(useErrorsStore.getState().errors.dashboard.data).toEqual(
            expect.objectContaining({ message: expect.any(String) }),
        );
        expect(useDashboardStore.getState().balances).toBe(confirmedBalances);
    });
});

test('preserves the complete confirmed dashboard snapshot when dashboard fails', () => {
    const requestError = new Error('Dashboard unavailable');
    const confirmedActivityItems = useDashboardStore.getState().activityItems;
    useDashboardStore.setState({ balances });
    vi.mocked(chipinApi.fetchApiDashboard).mockRejectedValue(requestError);

    return useDashboardStore.getState().fetchSetDashboard().then(() => {
        expect(useErrorsStore.getState().errors.dashboard.data).toEqual(
            expect.objectContaining({ message: expect.any(String) }),
        );
        expect(useDashboardStore.getState().balances).toBe(balances);
        expect(useDashboardStore.getState().activityItems).toBe(confirmedActivityItems);
    });
});

test('does not let an older dashboard response overwrite a forced refresh', () => {
    let oldSignal: AbortSignal | undefined;
    let resolveOld: ((value: {
        balances: Record<string, never>;
        activity: { items: []; nextCursor: null };
    }) => void) | undefined;
    vi.mocked(chipinApi.fetchApiDashboard)
        .mockImplementationOnce(signal => new Promise(resolve => {
            oldSignal = signal;
            resolveOld = resolve;
        }))
        .mockResolvedValueOnce({
            balances: { USD: { currency: 'USD', netBalance: 40 } },
            activity: { items: [], nextCursor: null },
        });
    const oldRequest = useDashboardStore.getState().fetchSetDashboard();
    const newRequest = useDashboardStore.getState().fetchSetDashboard(true);
    resolveOld?.({ balances: {}, activity: { items: [], nextCursor: null } });

    return Promise.all([oldRequest, newRequest]).then(() => {
        expect(oldSignal?.aborted).toBe(true);
        expect(chipinApi.fetchApiDashboard).toHaveBeenCalledTimes(2);
        expect(useDashboardStore.getState().balances).toEqual({
            USD: { currency: 'USD', netBalance: 40 },
        });
    });
});

test('ignores a stale dashboard failure after a newer refresh succeeds', () => {
    let rejectOld: ((reason: unknown) => void) | undefined;
    vi.mocked(chipinApi.fetchApiDashboard)
        .mockImplementationOnce(() => new Promise((_, reject) => {
            rejectOld = reject;
        }))
        .mockResolvedValueOnce({
            balances: { USD: { currency: 'USD', netBalance: 40 } },
            activity: { items: [], nextCursor: null },
        });

    const oldRequest = useDashboardStore.getState().fetchSetDashboard();
    const newRequest = useDashboardStore.getState().fetchSetDashboard(true);

    if (!rejectOld) {
        throw new Error('Old dashboard rejection is unavailable');
    }

    rejectOld(new Error('Stale dashboard failure'));

    return Promise.all([oldRequest, newRequest]).then(() => {
        expect(useDashboardStore.getState().balances).toEqual({
            USD: { currency: 'USD', netBalance: 40 },
        });
    });
});

test('appends dashboard activity previews and advances the cursor', () => {
    const activityEvent = {
        id: 'activity-1',
        seq: 1,
        domain: 'LEDGER',
        action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
        actorUserId: 'user-1',
        actorSnapshot: { displayName: 'Alex', picture: null },
        subjectType: 'expense',
        subjectId: 'expense-1',
        groupId: null,
        metadata: {
            type: 'expense',
            entryId: 'expense-1',
            groupId: null,
            groupName: null,
            description: 'Dinner',
            amount: 20,
            currency: 'USD',
            payerId: 'user-1',
            payerDisplayName: 'Alex',
            shares: [],
        },
        createdAt: 1,
        parentActivityId: null,
    } satisfies AppEvent;
    const existingItem = {
        parent: activityEvent,
        lastEvent: activityEvent,
    };
    const nextEvent = {
        ...activityEvent,
        id: 'activity-2',
        seq: 2,
    } satisfies AppEvent;
    const nextItem = {
        parent: nextEvent,
        lastEvent: nextEvent,
    };
    useDashboardStore.setState({
        activityItems: [existingItem],
        activityNextCursor: 40,
    });
    vi.mocked(activityApi.fetchActivityPreviews).mockResolvedValue({
        items: [nextItem],
        nextCursor: null,
    });

    return useDashboardStore
        .getState()
        .fetchMoreDashboardActivity()
        .then(() => {
            expect(activityApi.fetchActivityPreviews).toHaveBeenCalledWith(
                {
                    limit: 20,
                    cursor: 40,
                },
                expect.any(AbortSignal),
            );
            expect(useDashboardStore.getState()).toMatchObject({
                activityItems: [existingItem, nextItem],
                activityNextCursor: null,
            });
            return useDashboardStore.getState().fetchMoreDashboardActivity();
        })
        .then(() => {
            expect(activityApi.fetchActivityPreviews).toHaveBeenCalledOnce();
        });
});

test('prevents parallel dashboard requests for the same cursor', () => {
    let resolveRequest: ((value: { items: []; nextCursor: null }) => void) | undefined;
    const pendingRequest = new Promise<{ items: []; nextCursor: null }>(resolve => {
        resolveRequest = resolve;
    });
    useDashboardStore.setState({ activityNextCursor: 40 });
    vi.mocked(activityApi.fetchActivityPreviews).mockReturnValue(pendingRequest);

    const firstRequest = useDashboardStore.getState().fetchMoreDashboardActivity();
    const duplicateRequest = useDashboardStore.getState().fetchMoreDashboardActivity();

    expect(activityApi.fetchActivityPreviews).toHaveBeenCalledOnce();

    if (!resolveRequest) {
        throw new Error('Dashboard activity request resolver is unavailable');
    }

    resolveRequest({ items: [], nextCursor: null });

    return Promise.all([firstRequest, duplicateRequest]).then(() => undefined);
});

test('preserves dashboard activities and cursor when pagination fails', () => {
    const requestError = new Error('Dashboard page unavailable');
    useDashboardStore.setState({ activityNextCursor: 40 });
    vi.mocked(activityApi.fetchActivityPreviews).mockRejectedValue(requestError);

    return useDashboardStore
        .getState()
        .fetchMoreDashboardActivity()
        .then(() => {
            expect(useErrorsStore.getState().errors.dashboard.nextPage).toEqual(
                expect.objectContaining({ message: expect.any(String) }),
            );
            expect(useDashboardStore.getState().activityNextCursor).toBe(40);
            expect(useLoadingStore.getState().dashboard.nextPage).toBe('fetched');
        });
});

test('does not append a page requested before a forced dashboard refresh', () => {
    let pageSignal: AbortSignal | undefined;
    let resolvePage: ((value: { items: []; nextCursor: null }) => void) | undefined;
    useDashboardStore.setState({ activityNextCursor: 40 });
    vi.mocked(activityApi.fetchActivityPreviews).mockImplementation((_params, signal) =>
        new Promise(resolve => {
            pageSignal = signal;
            resolvePage = resolve;
        }),
    );
    vi.mocked(chipinApi.fetchApiDashboard).mockResolvedValue({
        balances: { USD: { currency: 'USD', netBalance: 18 } },
        activity: { items: [], nextCursor: null },
    });

    const pageRequest = useDashboardStore.getState().fetchMoreDashboardActivity();
    const refreshRequest = useDashboardStore.getState().fetchSetDashboard(true);

    if (!resolvePage) {
        throw new Error('Dashboard page resolver is unavailable');
    }

    resolvePage({ items: [], nextCursor: null });

    return Promise.all([pageRequest, refreshRequest]).then(() => {
        expect(pageSignal?.aborted).toBe(true);
        expect(useDashboardStore.getState()).toMatchObject({
            activityItems: [],
            activityNextCursor: null,
            balances: { USD: { currency: 'USD', netBalance: 18 } },
        });
    });
});

test('ignores a stale dashboard pagination failure after reset', () => {
    let requestSignal: AbortSignal | undefined;
    let rejectRequest: ((reason: unknown) => void) | undefined;
    const pendingRequest = new Promise<{ items: []; nextCursor: null }>((_, reject) => {
        rejectRequest = reject;
    });
    useDashboardStore.setState({ activityNextCursor: 40 });
    vi.mocked(activityApi.fetchActivityPreviews).mockImplementation((_params, signal) => {
        requestSignal = signal;
        return pendingRequest;
    });

    const request = useDashboardStore.getState().fetchMoreDashboardActivity();
    useDashboardStore.getState().setInitialDashboardStore();

    expect(requestSignal?.aborted).toBe(true);

    if (!rejectRequest) {
        throw new Error('Dashboard activity rejection is unavailable');
    }

    rejectRequest(new Error('Stale dashboard failure'));

    return expect(request).resolves.toBeUndefined();
});
