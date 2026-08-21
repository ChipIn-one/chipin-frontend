import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import * as activityApi from 'api/activityApi';
import * as ledgerApi from 'api/ledgerApi';
import {
    ACTIVITY_ACTIONS,
    ACTIVITY_CATEGORIES,
} from 'constants/activity';

import { useDashboardStore } from '../dashboardStore';
import { useErrorsStore } from '../errorsStore';
import { useGroupsStore } from '../groupsStore';
import { useLoadingStore } from '../loadingStore';
import { useUsersStore } from '../users-store';

import { useActivityStore } from './actions';
import { initialState } from './initialState';

vi.mock('api/activityApi', () => ({
    fetchActivities: vi.fn(),
    fetchActivityChildren: vi.fn(),
}));

vi.mock('api/ledgerApi', () => ({
    createExpense: vi.fn(),
    createSettlement: vi.fn(),
    removeLedgerEntry: vi.fn(),
}));

const originalRefreshActions = {
    fetchSetActivity: useActivityStore.getState().fetchSetActivity,
    fetchSetActivitySubevents: useActivityStore.getState().fetchSetActivitySubevents,
    fetchSetDashboard: useDashboardStore.getState().fetchSetDashboard,
    fetchSetFriends: useUsersStore.getState().fetchSetFriends,
    fetchSetGroupById: useGroupsStore.getState().fetchSetGroupById,
    fetchSetGroups: useGroupsStore.getState().fetchSetGroups,
};

beforeEach(() => {
    vi.clearAllMocks();
    useActivityStore.setState(initialState);
    useErrorsStore.getState().resetErrors();
    useLoadingStore.getState().setInitialLoadingStore();
});

afterEach(() => {
    useActivityStore.setState({
        fetchSetActivity: originalRefreshActions.fetchSetActivity,
        fetchSetActivitySubevents: originalRefreshActions.fetchSetActivitySubevents,
    });
    useDashboardStore.setState({
        fetchSetDashboard: originalRefreshActions.fetchSetDashboard,
    });
    useGroupsStore.setState({
        fetchSetGroupById: originalRefreshActions.fetchSetGroupById,
        fetchSetGroups: originalRefreshActions.fetchSetGroups,
    });
    useUsersStore.setState({
        fetchSetFriends: originalRefreshActions.fetchSetFriends,
    });
});

const createActivityEvent = (id: string, seq: number): AppEvent => ({
    id,
    seq,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: {
        displayName: 'Alex',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: `expense-${seq}`,
    groupId: 'group-1',
    metadata: {
        type: 'expense',
        entryId: `expense-${seq}`,
        groupId: 'group-1',
        groupName: 'Group',
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'user-1',
        payerDisplayName: 'Alex',
        shares: [],
    },
    createdAt: seq,
    parentActivityId: null,
});

test('resets activity state', () => {
    useActivityStore.setState({
        nextCursor: 25,
        hasMore: false,
        subeventsNextCursor: 40,
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
    });

    useActivityStore.getState().resetActivity();

    expect(useActivityStore.getState()).toMatchObject(initialState);
});

test('records an error when fetching activity subevents fails', () => {
    const requestError = new Error('Subevents unavailable');
    const confirmedEvent = createActivityEvent('confirmed-activity', 1);
    vi.mocked(activityApi.fetchActivityChildren).mockRejectedValue(
        requestError,
    );
    useActivityStore.setState({
        subevents: [confirmedEvent],
        subeventsNextCursor: 40,
        hasMoreSubevents: true,
        subeventsParent: createActivityEvent('confirmed-parent', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
    });

    return useActivityStore
        .getState()
        .fetchSetActivitySubevents({
            parentActivityId: 'activity-1',
            category: ACTIVITY_CATEGORIES.EXPENSE,
        })
        .then(() => {
            expect(useErrorsStore.getState().errors.activity.subeventsData).toEqual(
                expect.objectContaining({ message: expect.any(String) }),
            );
            expect(useActivityStore.getState()).toMatchObject({
                subevents: [confirmedEvent],
                subeventsNextCursor: 40,
                hasMoreSubevents: true,
                subeventsParent: null,
            });
            expect(useLoadingStore.getState().activity.subeventsData).toBe(
                'fetched',
            );
        });
});

test('records an error and preserves subevent pagination after a page request fails', () => {
    const requestError = new Error('Next page unavailable');
    vi.mocked(activityApi.fetchActivityChildren).mockRejectedValue(requestError);
    useActivityStore.setState({
        subeventsNextCursor: 40,
        subeventsParent: createActivityEvent('activity-1', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
        hasMoreSubevents: true,
    });

    return useActivityStore
        .getState()
        .fetchMoreActivitySubevents()
        .then(() => {
            expect(useErrorsStore.getState().errors.activity.subeventsNextPage).toEqual(
                expect.objectContaining({ message: expect.any(String) }),
            );
            expect(useActivityStore.getState()).toMatchObject({
                subeventsNextCursor: 40,
                hasMoreSubevents: true,
            });
            expect(
                useLoadingStore.getState().activity
                    .subeventsNextPage,
            ).toBe('fetched');
        });
});

test('appends subevents in API order', () => {
    const existingEvent = createActivityEvent('activity-1', 1);
    const nextEvent = createActivityEvent('activity-2', 2);
    useActivityStore.setState({
        subevents: [existingEvent],
        subeventsNextCursor: 40,
        subeventsParent: createActivityEvent('parent-1', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
        hasMoreSubevents: true,
    });
    vi.mocked(activityApi.fetchActivityChildren).mockResolvedValue({
        parent: createActivityEvent('parent-1', 0),
        items: [nextEvent],
        nextCursor: null,
    });

    return useActivityStore
        .getState()
        .fetchMoreActivitySubevents()
        .then(() => {
            expect(useActivityStore.getState().subevents).toEqual([
                existingEvent,
                nextEvent,
            ]);
        });
});

test('does not let a slower parent request replace the selected activity history', () => {
    const firstEvent = createActivityEvent('activity-1', 1);
    const secondEvent = createActivityEvent('activity-2', 2);
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: ((value: {
        parent: AppEvent;
        items: AppEvent[];
        nextCursor: null;
    }) => void) | undefined;
    vi.mocked(activityApi.fetchActivityChildren)
        .mockImplementationOnce((_params, signal) => new Promise(resolve => {
            firstSignal = signal;
            resolveFirst = resolve;
        }))
        .mockResolvedValueOnce({
            parent: createActivityEvent('parent-2', 0),
            items: [secondEvent],
            nextCursor: null,
        });

    const firstRequest = useActivityStore.getState().fetchSetActivitySubevents({
        parentActivityId: 'parent-1',
    });
    const secondRequest = useActivityStore.getState().fetchSetActivitySubevents({
        parentActivityId: 'parent-2',
    });

    if (!resolveFirst) {
        throw new Error('First activity request resolver is unavailable');
    }

    resolveFirst({
        parent: createActivityEvent('parent-1', 0),
        items: [firstEvent],
        nextCursor: null,
    });

    return Promise.all([firstRequest, secondRequest]).then(() => {
        expect(firstSignal?.aborted).toBe(true);
        expect(useActivityStore.getState()).toMatchObject({
            subevents: [secondEvent],
            subeventsParent: expect.objectContaining({ id: 'parent-2' }),
        });
    });
});

test('aborts pending subevent pagination before replacing the selected history', () => {
    let pageSignal: AbortSignal | undefined;
    let resolvePage: ((value: {
        parent: AppEvent;
        items: AppEvent[];
        nextCursor: null;
    }) => void) | undefined;
    useActivityStore.setState({
        subeventsNextCursor: 40,
        subeventsParent: createActivityEvent('parent-1', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
        hasMoreSubevents: true,
    });
    vi.mocked(activityApi.fetchActivityChildren)
        .mockImplementationOnce((_params, signal) => new Promise(resolve => {
            pageSignal = signal;
            resolvePage = resolve;
        }))
        .mockResolvedValueOnce({
            parent: createActivityEvent('parent-1', 0),
            items: [],
            nextCursor: null,
        });

    const pageRequest = useActivityStore.getState().fetchMoreActivitySubevents();
    const refreshRequest = useActivityStore.getState().fetchSetActivitySubevents({
        parentActivityId: 'parent-1',
        category: ACTIVITY_CATEGORIES.EXPENSE,
        force: true,
    });

    resolvePage?.({
        parent: createActivityEvent('parent-1', 0),
        items: [],
        nextCursor: null,
    });

    return Promise.all([pageRequest, refreshRequest]).then(() => {
        expect(pageSignal?.aborted).toBe(true);
    });
});

test('settles feed pagination when a forced feed refresh aborts it', () => {
    let pageSignal: AbortSignal | undefined;
    let resolvePage: ((value: { items: AppEvent[]; nextCursor: null }) => void) | undefined;
    useActivityStore.setState({ nextCursor: 40, hasMore: true });
    vi.mocked(activityApi.fetchActivities)
        .mockImplementationOnce((_params, signal) => new Promise(resolve => {
            pageSignal = signal;
            resolvePage = resolve;
        }))
        .mockResolvedValueOnce({ items: [], nextCursor: null });

    const pageRequest = useActivityStore.getState().fetchMoreActivity();
    const refreshRequest = useActivityStore.getState().fetchSetActivity(true);

    resolvePage?.({ items: [], nextCursor: null });

    return Promise.all([pageRequest, refreshRequest]).then(() => {
        expect(pageSignal?.aborted).toBe(true);
        expect(useLoadingStore.getState().activity.nextPage).toBe('fetched');
    });
});

test('records the newest feed refresh failure for replaced requests', () => {
    const refreshError = new Error('Fresh activity unavailable');
    vi.mocked(activityApi.fetchActivities)
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockRejectedValueOnce(refreshError);

    const firstRequest = useActivityStore.getState().fetchSetActivity();
    const newestRequest = useActivityStore.getState().fetchSetActivity(true);

    return Promise.all([firstRequest, newestRequest]).then(() => {
        expect(useErrorsStore.getState().errors.activity.data).toEqual(
            expect.objectContaining({ message: expect.any(String) }),
        );
    });
});

test('does not append the same activity page twice while pagination is loading', () => {
    const firstEvent = createActivityEvent('activity-1', 1);
    const nextEvent = createActivityEvent('activity-2', 2);
    let resolvePage: ((value: { items: AppEvent[]; nextCursor: null }) => void) | undefined;

    useActivityStore.setState({
        items: [firstEvent],
        nextCursor: 40,
        hasMore: true,
    });
    vi.mocked(activityApi.fetchActivities).mockImplementationOnce(
        () => new Promise(resolve => {
            resolvePage = resolve;
        }),
    );

    const firstRequest = useActivityStore.getState().fetchMoreActivity();
    const secondRequest = useActivityStore.getState().fetchMoreActivity();

    expect(activityApi.fetchActivities).toHaveBeenCalledOnce();
    resolvePage?.({ items: [nextEvent], nextCursor: null });

    return Promise.all([firstRequest, secondRequest]).then(() => {
        expect(useActivityStore.getState().items).toEqual([firstEvent, nextEvent]);
    });
});

test('accepts zero as a valid subevent pagination cursor', () => {
    useActivityStore.setState({
        subeventsNextCursor: 0,
        subeventsParent: createActivityEvent('parent-1', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
        hasMoreSubevents: true,
    });
    vi.mocked(activityApi.fetchActivityChildren).mockResolvedValue({
        parent: createActivityEvent('parent-1', 0),
        items: [],
        nextCursor: null,
    });

    return useActivityStore
        .getState()
        .fetchMoreActivitySubevents()
        .then(() => {
            expect(activityApi.fetchActivityChildren).toHaveBeenCalledWith(
                {
                    parentActivityId: 'parent-1',
                    category: ACTIVITY_CATEGORIES.EXPENSE,
                    limit: 20,
                    cursor: 0,
                },
                expect.any(AbortSignal),
            );
        });
});

test('creates a direct expense and refetches affected backend resources', () => {
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    const fetchSetDashboard = vi.fn().mockResolvedValue(undefined);
    const fetchSetFriends = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
    useActivityStore.setState({ fetchSetActivity });
    useDashboardStore.setState({ fetchSetDashboard });
    useUsersStore.setState({ fetchSetFriends });

    return useActivityStore.getState().createExpense({
        description: 'Dinner',
        amount: 20,
        date: 1,
        payerId: 'user-1',
        participantIds: ['user-2'],
        currency: 'USD',
    }).then(() => {
        expect(fetchSetDashboard).toHaveBeenCalledWith(true);
        expect(fetchSetFriends).toHaveBeenCalledWith(true);
        expect(fetchSetActivity).toHaveBeenCalledWith(true);
    });
});

test('creates a group settlement and refetches the affected group', () => {
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    const fetchSetDashboard = vi.fn().mockResolvedValue(undefined);
    const fetchSetGroupById = vi.fn().mockResolvedValue(null);
    vi.mocked(ledgerApi.createSettlement).mockResolvedValue({} as never);
    useActivityStore.setState({ fetchSetActivity });
    useDashboardStore.setState({ fetchSetDashboard });
    useGroupsStore.setState({ fetchSetGroupById });

    return useActivityStore.getState().createSettlement({
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: 10,
        currency: 'USD',
        groupId: 'group-1',
    }).then(() => {
        expect(fetchSetGroupById).toHaveBeenCalledWith('group-1', true);
    });
});

test('reverses a ledger entry without locally patching activity state', () => {
    const confirmedItems = [createActivityEvent('activity-1', 1)];
    vi.mocked(ledgerApi.removeLedgerEntry).mockResolvedValue(undefined);
    useActivityStore.setState({
        items: confirmedItems,
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    useDashboardStore.setState({
        fetchSetDashboard: vi.fn().mockResolvedValue(undefined),
    });
    useUsersStore.setState({
        fetchSetFriends: vi.fn().mockResolvedValue(undefined),
    });

    return useActivityStore.getState().reverseLedgerEntry({
        entryId: 'expense-1',
    }).then(() => {
        expect(ledgerApi.removeLedgerEntry).toHaveBeenCalledWith({ entryId: 'expense-1' });
        expect(useActivityStore.getState().items).toEqual(confirmedItems);
    });
});

test('resolves after a confirmed mutation when refreshes resolve', () => {
    vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    useDashboardStore.setState({
        fetchSetDashboard: vi.fn().mockResolvedValue(undefined),
    });
    useUsersStore.setState({
        fetchSetFriends: vi.fn().mockResolvedValue(undefined),
    });

    return useActivityStore.getState().createExpense({
        description: 'Dinner',
        amount: 20,
        date: 1,
        payerId: 'user-1',
        participantIds: ['user-2'],
        currency: 'USD',
    }).then(result => {
        expect(result).toBeUndefined();
        expect(ledgerApi.createExpense).toHaveBeenCalledOnce();
    });
});

test('does not refetch when an expense mutation fails', () => {
    const mutationError = new Error('Create failed');
    const fetchSetDashboard = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ledgerApi.createExpense).mockRejectedValue(mutationError);
    useDashboardStore.setState({ fetchSetDashboard });

    return expect(useActivityStore.getState().createExpense({
        description: 'Dinner',
        amount: 20,
        date: 1,
        payerId: 'user-1',
        participantIds: ['user-2'],
        currency: 'USD',
    })).rejects.toBe(mutationError).then(() => {
        expect(fetchSetDashboard).not.toHaveBeenCalled();
    });
});
