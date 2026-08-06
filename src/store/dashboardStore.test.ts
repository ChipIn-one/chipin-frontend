import { beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import * as activityApi from 'api/activityApi';
import type { UserSettings } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';

import { APP_MODES, useDashboardStore } from './dashboardStore';
import { useLoadingStore } from './loadingStore';

vi.mock('api/activityApi', () => ({
    fetchActivityPreviews: vi.fn(),
}));

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
            fieldDiffs: [],
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
            expect(activityApi.fetchActivityPreviews).toHaveBeenCalledWith({
                limit: 20,
                cursor: 40,
            });
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
        .then(
            () => Promise.reject(new Error('Expected dashboard pagination to reject')),
            error => {
                expect(error).toBe(requestError);
                expect(useDashboardStore.getState().activityNextCursor).toBe(40);
                expect(useLoadingStore.getState().dashboard.nextPage).toBe('fetched');
            },
        );
});

test('ignores a stale dashboard pagination failure after reset', () => {
    let rejectRequest: ((reason: unknown) => void) | undefined;
    const pendingRequest = new Promise<{ items: []; nextCursor: null }>((_, reject) => {
        rejectRequest = reject;
    });
    useDashboardStore.setState({ activityNextCursor: 40 });
    vi.mocked(activityApi.fetchActivityPreviews).mockReturnValue(pendingRequest);

    const request = useDashboardStore.getState().fetchMoreDashboardActivity();
    useDashboardStore.getState().setInitialDashboardStore();

    if (!rejectRequest) {
        throw new Error('Dashboard activity rejection is unavailable');
    }

    rejectRequest(new Error('Stale dashboard failure'));

    return expect(request).resolves.toBeUndefined();
});
