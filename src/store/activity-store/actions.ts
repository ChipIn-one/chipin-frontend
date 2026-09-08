import { create } from 'zustand';

import * as activityApi from 'api/activityApi';
import * as ledgerApi from 'api/ledgerApi';
import { normalizeApiError } from 'helpers/errors';

import { useDashboardStore } from '../dashboardStore';
import { useErrorsStore } from '../errorsStore';
import { mapActivityExpenseToModalState } from '../expenseModalEditMapping';
import type {
    ExpenseModalEditInitialization,
    ExpenseModalSource,
} from '../expenseModalStore';
import { useGroupsStore } from '../groupsStore';
import { createRequestChannel } from '../internal/resourceRequests';
import { useLoadingStore } from '../loadingStore';
import {
    selectUserCurrency,
    selectUserDefaultCategory,
    selectUserSkipCategory,
    useUsersStore,
} from '../users-store';

import { ACTIVITY_API_LIMIT } from './constants';
import { initialState } from './initialState';
import type {
    ActivityStore,
    CreateExpenseParams,
    CreateSettlementActionParams,
    PrepareExpenseEditParams,
    ReverseLedgerEntryParams,
    UpdateExpenseParams,
} from './types';

const activityFeedChannel = createRequestChannel();
const activityFeedPageChannel = createRequestChannel();
const activityChildrenChannel = createRequestChannel();
const activityChildrenPageChannel = createRequestChannel();

interface FinancialRefreshContext {
    groupId?: string;
    parentActivityId?: string;
}

const refreshFinancialData = (
    activityState: ActivityStore,
    { groupId, parentActivityId }: FinancialRefreshContext,
): Promise<void> => {
    const requests: Promise<unknown>[] = [
        useDashboardStore.getState().fetchSetDashboard(true),
        activityState.fetchSetActivity(true),
    ];

    if (groupId) {
        requests.push(useGroupsStore.getState().fetchSetGroupById(groupId, true));
    } else {
        requests.push(useUsersStore.getState().fetchSetFriends(true));
    }

    if (parentActivityId) {
        const category =
            activityState.subeventsParent?.id === parentActivityId
                ? (activityState.subeventsCategory ?? undefined)
                : undefined;
        requests.push(
            activityState.fetchSetActivitySubevents({
                parentActivityId,
                category,
                force: true,
            }),
        );
    }

    return Promise.all(requests).then(() => undefined);
};

const createExpense = (get: () => ActivityStore, params: CreateExpenseParams): Promise<void> => {
    const { parentActivityId, ...request } = params;
    const { setLoading } = useLoadingStore.getState();
    const { clearError, setError } = useErrorsStore.getState();
    clearError('expense', 'add');
    setLoading('expense', 'add', 'loading');

    return ledgerApi
        .createExpense(request)
        .catch((error: unknown) => {
            setError('expense', 'add', normalizeApiError(error));
            return Promise.reject(error);
        })
        .then(() =>
            refreshFinancialData(get(), {
                groupId: request.groupId,
                parentActivityId,
            }).catch(() => undefined),
        )
        .finally(() => {
            setLoading('expense', 'add', 'fetched');
        });
};

const getExpenseEditSource = (): ExpenseModalSource => {
    const usersState = useUsersStore.getState();
    const groupsState = useGroupsStore.getState();

    return {
        context: 'dashboard',
        currentUser: usersState.user,
        defaultCurrency: selectUserCurrency(usersState),
        defaultCategory: selectUserDefaultCategory(usersState),
        skipCategory: selectUserSkipCategory(usersState),
        groups: groupsState.groups.map(group => ({
            id: group.id,
            name: group.name,
            members: group.members.map(member => member.user),
        })),
        knownFriends: usersState.friends.map(friend => friend.user),
        defaultGroupId: groupsState.selectedGroup?.id ?? groupsState.groups[0]?.id,
    };
};

const prepareExpenseEdit = ({
    parentEvent,
    childEvents,
    parentActivityId,
}: PrepareExpenseEditParams): ExpenseModalEditInitialization | null => {
    return mapActivityExpenseToModalState({
        parentEvent,
        childEvents,
        source: getExpenseEditSource(),
        parentActivityId,
    });
};

const updateExpense = (
    get: () => ActivityStore,
    { entryId, entry, groupId, parentActivityId }: UpdateExpenseParams,
): Promise<void> => {
    const { setLoading } = useLoadingStore.getState();
    const { clearError, setError } = useErrorsStore.getState();
    clearError('expense', 'update');
    setLoading('expense', 'update', 'loading');

    return ledgerApi
        .updateExpense({ entryId, entry })
        .catch((error: unknown) => {
            setError('expense', 'update', normalizeApiError(error));
            return Promise.reject(error);
        })
        .then(() =>
            refreshFinancialData(get(), { groupId, parentActivityId }).catch(() => undefined),
        )
        .finally(() => {
            setLoading('expense', 'update', 'fetched');
        });
};

const createSettlement = (
    get: () => ActivityStore,
    params: CreateSettlementActionParams,
): Promise<void> => {
    const { parentActivityId, ...request } = params;
    const { setLoading } = useLoadingStore.getState();
    const { clearError, setError } = useErrorsStore.getState();
    clearError('settlement', 'add');
    setLoading('settlement', 'add', 'loading');

    return ledgerApi
        .createSettlement(request)
        .catch((error: unknown) => {
            setError('settlement', 'add', normalizeApiError(error));
            return Promise.reject(error);
        })
        .then(() =>
            refreshFinancialData(get(), {
                groupId: request.groupId,
                parentActivityId,
            }).catch(() => undefined),
        )
        .finally(() => {
            setLoading('settlement', 'add', 'fetched');
        });
};

const reverseLedgerEntry = (
    get: () => ActivityStore,
    { entryId, groupId, parentActivityId }: ReverseLedgerEntryParams,
): Promise<void> => {
    const { setLoading } = useLoadingStore.getState();
    const { clearError, setError } = useErrorsStore.getState();
    clearError('ledger', 'remove');
    setLoading('ledger', 'remove', 'loading');

    return ledgerApi
        .removeLedgerEntry({ entryId })
        .catch((error: unknown) => {
            setError('ledger', 'remove', normalizeApiError(error));
            return Promise.reject(error);
        })
        .then(() =>
            refreshFinancialData(get(), { groupId, parentActivityId }).catch(() => undefined),
        )
        .finally(() => {
            setLoading('ledger', 'remove', 'fetched');
        });
};

const useActivityStore = create<ActivityStore>((set, get) => ({
    ...initialState,

    createExpense: params => createExpense(get, params),
    prepareExpenseEdit,
    updateExpense: params => updateExpense(get, params),
    createSettlement: params => createSettlement(get, params),
    reverseLedgerEntry: params => reverseLedgerEntry(get, params),

    fetchSetActivity: (force = false) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        clearError('activity', 'data');

        if (force) {
            activityFeedPageChannel.abort();
            setLoading('activity', 'nextPage', 'fetched');
        }

        const request = activityFeedChannel.request(
            signal => activityApi.fetchActivities({ limit: ACTIVITY_API_LIMIT }, signal),
            { force },
        );
        setLoading('activity', 'data', 'loading');

        return request.promise
            .then(data => {
                if (!request.isCurrent()) {
                    return;
                }

                set({
                    items: data.items,
                    nextCursor: data.nextCursor,
                    hasMore: data.nextCursor !== null,
                });
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('activity', 'data', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('activity', 'data', 'fetched');
                }
            });
    },

    fetchMoreActivity: () => {
        const { nextCursor } = get();
        const { setLoading, activity } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        if (nextCursor === null || activity.nextPage === 'loading') {
            return Promise.resolve();
        }

        clearError('activity', 'nextPage');
        setLoading('activity', 'nextPage', 'loading');

        const request = activityFeedPageChannel.request(
            signal =>
                activityApi.fetchActivities(
                    {
                        limit: ACTIVITY_API_LIMIT,
                        cursor: nextCursor,
                    },
                    signal,
                ),
            { identity: String(nextCursor) },
        );

        return request.promise
            .then(data => {
                if (!request.isCurrent()) {
                    return;
                }

                set(state => ({
                    items: [...state.items, ...data.items],
                    nextCursor: data.nextCursor,
                    hasMore: data.nextCursor !== null,
                }));
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('activity', 'nextPage', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('activity', 'nextPage', 'fetched');
                }
            });
    },

    fetchSetActivitySubevents: ({ parentActivityId, category, force = false }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const viewTarget = `${parentActivityId}:${category ?? 'all'}`;

        activityChildrenPageChannel.abort();

        const request = activityChildrenChannel.request(
            signal =>
                activityApi.fetchActivityChildren(
                    {
                        parentActivityId,
                        category,
                        limit: ACTIVITY_API_LIMIT,
                    },
                    signal,
                ),
            { force, identity: viewTarget },
        );
        clearError('activity', 'subeventsData');
        set({ subeventsParent: null });
        setLoading('activity', 'subeventsData', 'loading');
        setLoading('activity', 'subeventsNextPage', 'fetched');

        return request.promise
            .then(data => {
                if (!request.isCurrent()) {
                    return;
                }

                set({
                    subevents: data.items,
                    subeventsParent: data.parent,
                    subeventsNextCursor: data.nextCursor,
                    hasMoreSubevents: data.nextCursor !== null,
                    subeventsCategory: category ?? null,
                });
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('activity', 'subeventsData', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('activity', 'subeventsData', 'fetched');
                }
            });
    },

    fetchMoreActivitySubevents: () => {
        const { subeventsNextCursor, subeventsParent, subeventsCategory } = get();
        const parentActivityId = subeventsParent?.id;
        const { setLoading, activity } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        if (
            subeventsNextCursor === null ||
            !parentActivityId ||
            activity.subeventsNextPage === 'loading'
        ) {
            return Promise.resolve();
        }

        clearError('activity', 'subeventsNextPage');
        setLoading('activity', 'subeventsNextPage', 'loading');

        const request = activityChildrenPageChannel.request(
            signal =>
                activityApi.fetchActivityChildren(
                    {
                        parentActivityId,
                        category: subeventsCategory ?? undefined,
                        limit: ACTIVITY_API_LIMIT,
                        cursor: subeventsNextCursor,
                    },
                    signal,
                ),
            {
                identity: `${parentActivityId}:${subeventsCategory ?? 'all'}:${subeventsNextCursor}`,
            },
        );

        return request.promise
            .then(data => {
                if (!request.isCurrent()) {
                    return;
                }

                set(currentState => ({
                    subevents: [...currentState.subevents, ...data.items],
                    subeventsParent: data.parent,
                    subeventsNextCursor: data.nextCursor,
                    hasMoreSubevents: data.nextCursor !== null,
                }));
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('activity', 'subeventsNextPage', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('activity', 'subeventsNextPage', 'fetched');
                }
            });
    },

    resetActivitySubevents: () => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError } = useErrorsStore.getState();
        activityChildrenChannel.abort();
        activityChildrenPageChannel.abort();
        set({
            subevents: initialState.subevents,
            subeventsParent: initialState.subeventsParent,
            subeventsNextCursor: initialState.subeventsNextCursor,
            hasMoreSubevents: initialState.hasMoreSubevents,
            subeventsCategory: initialState.subeventsCategory,
        });
        setLoading('activity', 'subeventsData', 'fetched');
        setLoading('activity', 'subeventsNextPage', 'fetched');
        clearError('activity', 'subeventsData');
        clearError('activity', 'subeventsNextPage');
    },

    resetActivity: () => {
        const { setLoading } = useLoadingStore.getState();
        activityFeedChannel.abort();
        activityFeedPageChannel.abort();
        activityChildrenChannel.abort();
        activityChildrenPageChannel.abort();
        set(initialState);
        setLoading('activity', 'subeventsData', 'fetched');
        setLoading('activity', 'subeventsNextPage', 'fetched');
        useErrorsStore.getState().resetErrors();
    },
}));

export { useActivityStore };
