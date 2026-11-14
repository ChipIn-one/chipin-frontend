import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import * as activityApi from 'api/activityApi';
import type { ApiExpenseLedgerEntry } from 'api/chipin.raw.types';
import * as ledgerApi from 'api/ledgerApi';
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES } from 'constants/activity';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { useErrorsStore } from '../errorsStore';
import { invalidateGroup } from '../groupsList';
import { useLoadingStore } from '../loadingStore';
import { invalidateKnownUsers } from '../sessionUser';

import { useActivityStore } from './actions';
import { initialState } from './initialState';

vi.mock('../sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('../sessionUser')>()),
    invalidateKnownUsers: vi.fn(() => Promise.resolve()),
}));

vi.mock('../groupsList', async importOriginal => ({
    ...(await importOriginal<typeof import('../groupsList')>()),
    invalidateGroup: vi.fn(() => Promise.resolve()),
}));

vi.mock('api/activityApi', () => ({
    fetchActivityChildren: vi.fn(),
}));

vi.mock('api/ledgerApi', () => ({
    createExpense: vi.fn(),
    createSettlement: vi.fn(),
    fetchLedgerEntry: vi.fn(),
    removeLedgerEntry: vi.fn(),
    updateExpense: vi.fn(),
}));

const originalRefreshActions = {
    fetchSetActivity: useActivityStore.getState().fetchSetActivity,
    fetchSetActivitySubevents: useActivityStore.getState().fetchSetActivitySubevents,
};

let dashboardCache: UserDashboardCache;

beforeEach(() => {
    vi.clearAllMocks();
    dashboardCache = mountUserDashboardCache();
    useActivityStore.setState(initialState);
    useErrorsStore.getState().resetErrors();
    useLoadingStore.getState().setInitialLoadingStore();
});

afterEach(() => {
    dashboardCache.dispose();
    useActivityStore.setState({
        fetchSetActivity: originalRefreshActions.fetchSetActivity,
        fetchSetActivitySubevents: originalRefreshActions.fetchSetActivitySubevents,
    });
});

type ExpenseActivityEvent = Extract<AppEvent, { subjectType: 'expense' }>;

const createActivityEvent = (id: string, seq: number): ExpenseActivityEvent => ({
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

const editUser = (id: string, displayName: string) => ({
    id,
    email: `${id}@example.com`,
    displayName,
    firstName: displayName,
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
});

const editEntry: ApiExpenseLedgerEntry = {
    id: 'expense-edit-1',
    type: 'EXPENSE',
    scope: 'GROUP',
    groupId: 'group-1',
    systemAction: null,
    createdAt: 1,
    updatedAt: 1,
    expense: {
        id: 'expense-edit-1',
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        date: 1,
        payer: editUser('user-1', 'Alex'),
        groupId: 'group-1',
        participants: [editUser('user-1', 'Alex'), editUser('user-2', 'Sam')],
        participantShares: [
            { userId: 'user-1', shareAmount: 15, currency: 'USD' },
            { userId: 'user-2', shareAmount: 15, currency: 'USD' },
        ],
        category: 'food',
        subcategory: null,
        creator: editUser('user-1', 'Alex'),
        createdAt: 1,
        updatedAt: 1,
    },
    settlement: null,
};

test('resets activity state', () => {
    useActivityStore.setState({
        subeventsNextCursor: 40,
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
    });

    useActivityStore.getState().resetActivity();

    expect(useActivityStore.getState()).toMatchObject(initialState);
});

test('records an error when fetching activity subevents fails', () => {
    const requestError = new Error('Subevents unavailable');
    const confirmedEvent = createActivityEvent('confirmed-activity', 1);
    vi.mocked(activityApi.fetchActivityChildren).mockRejectedValue(requestError);
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
            expect(useLoadingStore.getState().activity.subeventsData).toBe('fetched');
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
            expect(useLoadingStore.getState().activity.subeventsNextPage).toBe('fetched');
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
            expect(useActivityStore.getState().subevents).toEqual([existingEvent, nextEvent]);
        });
});

test('does not let a slower parent request replace the selected activity history', () => {
    const firstEvent = createActivityEvent('activity-1', 1);
    const secondEvent = createActivityEvent('activity-2', 2);
    let firstSignal: AbortSignal | undefined;
    let resolveFirst:
        ((value: { parent: AppEvent; items: AppEvent[]; nextCursor: null }) => void) | undefined;
    vi.mocked(activityApi.fetchActivityChildren)
        .mockImplementationOnce(
            (_params, signal) =>
                new Promise(resolve => {
                    firstSignal = signal;
                    resolveFirst = resolve;
                }),
        )
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
    let resolvePage:
        ((value: { parent: AppEvent; items: AppEvent[]; nextCursor: null }) => void) | undefined;
    useActivityStore.setState({
        subeventsNextCursor: 40,
        subeventsParent: createActivityEvent('parent-1', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
        hasMoreSubevents: true,
    });
    vi.mocked(activityApi.fetchActivityChildren)
        .mockImplementationOnce(
            (_params, signal) =>
                new Promise(resolve => {
                    pageSignal = signal;
                    resolvePage = resolve;
                }),
        )
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
    vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
    useActivityStore.setState({ fetchSetActivity });
    vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

    return useActivityStore
        .getState()
        .createExpense({
            description: 'Dinner',
            amount: 20,
            date: 1,
            payerId: 'user-1',
            participantIds: ['user-2'],
            currency: 'USD',
        })
        .then(() => {
            expect(dashboardCache.isDashboardInvalidated()).toBe(true);
            expect(invalidateKnownUsers).toHaveBeenCalledOnce();
            expect(fetchSetActivity).toHaveBeenCalledWith(true);
        });
});

test('creates a group settlement and refetches the affected group', () => {
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ledgerApi.createSettlement).mockResolvedValue({} as never);
    useActivityStore.setState({ fetchSetActivity });

    return useActivityStore
        .getState()
        .createSettlement({
            fromUserId: 'user-1',
            toUserId: 'user-2',
            amount: 10,
            currency: 'USD',
            groupId: 'group-1',
        })
        .then(() => {
            expect(invalidateGroup).toHaveBeenCalledWith('group-1');
        });
});

test('does not reject a confirmed group expense when canonical refresh rejects', () => {
    const refreshError = new Error('Group refresh unavailable');
    vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(invalidateGroup).mockRejectedValueOnce(refreshError);

    return useActivityStore
        .getState()
        .createExpense({
            description: 'Dinner',
            amount: 20,
            date: 1,
            payerId: 'user-1',
            participantIds: ['user-2'],
            currency: 'USD',
            groupId: 'group-1',
        })
        .then(() => {
            expect(ledgerApi.createExpense).toHaveBeenCalledOnce();
            expect(invalidateGroup).toHaveBeenCalledWith('group-1');
        });
});

test('does not reject a confirmed settlement when canonical refresh rejects', () => {
    vi.mocked(ledgerApi.createSettlement).mockResolvedValue({} as never);
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(invalidateGroup).mockRejectedValueOnce(new Error('Group refresh unavailable'));

    return useActivityStore
        .getState()
        .createSettlement({
            fromUserId: 'user-1',
            toUserId: 'user-2',
            amount: 10,
            currency: 'USD',
            groupId: 'group-1',
        })
        .then(() => {
            expect(ledgerApi.createSettlement).toHaveBeenCalledOnce();
            expect(invalidateGroup).toHaveBeenCalledWith('group-1');
        });
});

test('reverses a ledger entry and refreshes the activity feeds', () => {
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ledgerApi.removeLedgerEntry).mockResolvedValue(undefined);
    useActivityStore.setState({ fetchSetActivity });
    vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

    return useActivityStore
        .getState()
        .reverseLedgerEntry({
            entryId: 'expense-1',
        })
        .then(() => {
            expect(ledgerApi.removeLedgerEntry).toHaveBeenCalledWith({ entryId: 'expense-1' });
            expect(fetchSetActivity).toHaveBeenCalledWith(true);
        });
});

test('does not reject a confirmed ledger reversal when canonical refresh rejects', () => {
    vi.mocked(ledgerApi.removeLedgerEntry).mockResolvedValue(undefined);
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(invalidateGroup).mockRejectedValueOnce(new Error('Group refresh unavailable'));

    return useActivityStore
        .getState()
        .reverseLedgerEntry({
            entryId: 'expense-1',
            groupId: 'group-1',
        })
        .then(() => {
            expect(ledgerApi.removeLedgerEntry).toHaveBeenCalledWith({ entryId: 'expense-1' });
            expect(invalidateGroup).toHaveBeenCalledWith('group-1');
        });
});

test('resolves after a confirmed mutation when refreshes resolve', () => {
    vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

    return useActivityStore
        .getState()
        .createExpense({
            description: 'Dinner',
            amount: 20,
            date: 1,
            payerId: 'user-1',
            participantIds: ['user-2'],
            currency: 'USD',
        })
        .then(result => {
            expect(result).toBeUndefined();
            expect(ledgerApi.createExpense).toHaveBeenCalledOnce();
        });
});

test('does not refetch when an expense mutation fails', () => {
    const mutationError = new Error('Create failed');
    vi.mocked(ledgerApi.createExpense).mockRejectedValue(mutationError);

    return expect(
        useActivityStore.getState().createExpense({
            description: 'Dinner',
            amount: 20,
            date: 1,
            payerId: 'user-1',
            participantIds: ['user-2'],
            currency: 'USD',
        }),
    )
        .rejects.toBe(mutationError)
        .then(() => {
            expect(dashboardCache.isDashboardInvalidated()).toBe(false);
        });
});

test('ACT-004 prepares an expense edit from the latest Activity snapshot without a ledger read', () => {
    const parentEvent = {
        ...createActivityEvent('activity-edit-parent', 1),
        subjectId: editEntry.id,
        metadata: {
            type: 'expense' as const,
            entryId: editEntry.id,
            groupId: 'group-1',
            groupName: 'Group',
            description: 'Dinner',
            amount: 30,
            currency: 'USD',
            category: 'food',
            subcategory: 'restaurants',
            payerId: 'user-1',
            payerDisplayName: 'Alex',
            shares: [
                {
                    userId: 'user-1',
                    displayName: 'Alex',
                    shareAmount: 15,
                    currency: 'USD',
                },
                {
                    userId: 'user-2',
                    displayName: 'Sam',
                    shareAmount: 15,
                    currency: 'USD',
                },
            ],
        },
    } satisfies AppEvent;
    const latestEvent = {
        ...parentEvent,
        id: 'activity-edit-latest',
        seq: 2,
        action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
        metadata: {
            ...parentEvent.metadata,
            description: 'Updated dinner',
            amount: 40,
            shares: [
                {
                    userId: 'user-1',
                    displayName: 'Alex',
                    shareAmount: 20,
                    currency: 'USD',
                },
                {
                    userId: 'user-2',
                    displayName: 'Sam',
                    shareAmount: 20,
                    currency: 'USD',
                },
            ],
        },
        parentActivityId: parentEvent.id,
    } satisfies AppEvent;

    const result = useActivityStore.getState().prepareExpenseEdit({
        parentEvent,
        childEvents: [latestEvent],
        parentActivityId: 'parent-1',
    });

    expect(ledgerApi.fetchLedgerEntry).not.toHaveBeenCalled();
    expect(result).toMatchObject({
        mode: 'edit',
        description: 'Updated dinner',
        amount: '40',
        editContext: {
            entryId: editEntry.id,
            groupId: 'group-1',
            parentActivityId: 'parent-1',
            original: {
                category: 'food',
                subcategory: 'restaurants',
            },
        },
    });
});

test('updates an expense and refreshes the original group scope', () => {
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ledgerApi.updateExpense).mockResolvedValue(editEntry);
    useActivityStore.setState({ fetchSetActivity });

    const entry = {
        type: 'EXPENSE' as const,
        expense: { description: 'Updated dinner' },
    };

    return useActivityStore
        .getState()
        .updateExpense({
            entryId: editEntry.id,
            entry,
            groupId: editEntry.groupId ?? undefined,
            parentActivityId: 'parent-1',
        })
        .then(() => {
            expect(ledgerApi.updateExpense).toHaveBeenCalledWith({
                entryId: editEntry.id,
                entry,
            });
            expect(invalidateGroup).toHaveBeenCalledWith('group-1');
            expect(dashboardCache.isDashboardInvalidated()).toBe(true);
            expect(fetchSetActivity).toHaveBeenCalledWith(true);
            expect(useLoadingStore.getState().expense.update).toBe('fetched');
        });
});

test('updates a direct expense and refreshes friends and visible subevents', () => {
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    const fetchSetActivitySubevents = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ledgerApi.updateExpense).mockResolvedValue(editEntry);
    useActivityStore.setState({
        fetchSetActivity,
        fetchSetActivitySubevents,
        subeventsParent: createActivityEvent('parent-1', 0),
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
    });
    vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

    return useActivityStore
        .getState()
        .updateExpense({
            entryId: editEntry.id,
            entry: {
                type: 'EXPENSE',
                expense: { description: 'Updated dinner' },
            },
            parentActivityId: 'parent-1',
        })
        .then(() => {
            expect(invalidateKnownUsers).toHaveBeenCalledOnce();
            expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
                parentActivityId: 'parent-1',
                category: ACTIVITY_CATEGORIES.EXPENSE,
                force: true,
            });
            expect(fetchSetActivity).toHaveBeenCalledWith(true);
            expect(dashboardCache.isDashboardInvalidated()).toBe(true);
        });
});

test('records and rejects an expense update failure without refreshing', () => {
    const mutationError = new Error('Update failed');
    vi.mocked(ledgerApi.updateExpense).mockRejectedValue(mutationError);

    return expect(
        useActivityStore.getState().updateExpense({
            entryId: editEntry.id,
            entry: {
                type: 'EXPENSE',
                expense: { description: 'Updated dinner' },
            },
        }),
    )
        .rejects.toBe(mutationError)
        .then(() => {
            expect(useErrorsStore.getState().errors.expense.update).toEqual(
                expect.objectContaining({ message: expect.any(String) }),
            );
            expect(useLoadingStore.getState().expense.update).toBe('fetched');
            expect(dashboardCache.isDashboardInvalidated()).toBe(false);
        });
});

test('does not reject a confirmed expense update when canonical refresh rejects', () => {
    vi.mocked(ledgerApi.updateExpense).mockResolvedValue(editEntry);
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockRejectedValue(new Error('Activity unavailable')),
    });
    vi.mocked(invalidateKnownUsers).mockRejectedValue(new Error('Friends unavailable'));

    return useActivityStore
        .getState()
        .updateExpense({
            entryId: editEntry.id,
            entry: {
                type: 'EXPENSE',
                expense: { description: 'Updated dinner' },
            },
        })
        .then(() => {
            expect(ledgerApi.updateExpense).toHaveBeenCalledOnce();
        });
});

test("the feed refresh marks the user's own activity feeds stale in the query cache", () => {
    expect(dashboardCache.isSelfActivityInvalidated()).toBe(false);

    return useActivityStore
        .getState()
        .fetchSetActivity(true)
        .then(() => {
            expect(dashboardCache.isSelfActivityInvalidated()).toBe(true);
        });
});

test('the feed refresh without a signed-in user does nothing and resolves', () => {
    dashboardCache.dispose();

    return expect(useActivityStore.getState().fetchSetActivity(true)).resolves.toBeUndefined();
});

test.each([
    [
        'an added expense',
        () => {
            vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
            return useActivityStore.getState().createExpense({
                description: 'Dinner',
                amount: 20,
                date: 1,
                payerId: 'user-1',
                participantIds: ['user-2'],
                currency: 'USD',
            });
        },
    ],
    [
        'an edited expense',
        () => {
            vi.mocked(ledgerApi.updateExpense).mockResolvedValue(editEntry);
            return useActivityStore.getState().updateExpense({
                entryId: editEntry.id,
                entry: { type: 'EXPENSE', expense: { description: 'Updated dinner' } },
            });
        },
    ],
    [
        'an added settle-up',
        () => {
            vi.mocked(ledgerApi.createSettlement).mockResolvedValue({} as never);
            return useActivityStore.getState().createSettlement({
                fromUserId: 'user-1',
                toUserId: 'user-2',
                amount: 10,
                currency: 'USD',
            });
        },
    ],
    [
        'a deleted entry',
        () => {
            vi.mocked(ledgerApi.removeLedgerEntry).mockResolvedValue(undefined);
            return useActivityStore.getState().reverseLedgerEntry({ entryId: 'expense-1' });
        },
    ],
])("%s marks the user's own activity feeds and the dashboard balances stale", (_name, write) =>
    write().then(() => {
        expect(dashboardCache.isSelfActivityInvalidated()).toBe(true);
        expect(dashboardCache.isDashboardInvalidated()).toBe(true);
    }),
);
