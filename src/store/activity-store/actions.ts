import { create } from 'zustand';

import * as activityApi from 'api/activityApi';
import * as ledgerApi from 'api/ledgerApi';

import { useLoadingStore } from '../loadingStore';
import { useUsersStore } from '../users-store';

import { ACTIVITY_API_LIMIT } from './constants';
import { initialState } from './initialState';
import type { ActivityStore } from './types';

const useActivityStore = create<ActivityStore>((set, get) => ({
    ...initialState,

    fetchSetActivity: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'data', 'loading');

        return activityApi
            .fetchActivities({ limit: ACTIVITY_API_LIMIT })
            .then(data => {
                set({
                    items: data.items,
                    nextCursor: data.nextCursor,
                    hasMore: data.nextCursor !== null,
                });
                setLoading('activity', 'data', 'fetched');
            })
            .catch(() => {
                setLoading('activity', 'data', 'fetched');
            });
    },

    fetchMoreActivity: () => {
        const { nextCursor, items } = get();

        if (!nextCursor) {
            return Promise.resolve();
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'nextPage', 'loading');

        return activityApi
            .fetchActivities({
                limit: ACTIVITY_API_LIMIT,
                cursor: nextCursor,
            })
            .then(data => {
                set({
                    items: [...items, ...data.items],
                    nextCursor: data.nextCursor,
                    hasMore: data.nextCursor !== null,
                });
                setLoading('activity', 'nextPage', 'fetched');
            })
            .catch(() => {
                setLoading('activity', 'nextPage', 'fetched');
            });
    },

    fetchSetSelectedEvent: activityId => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'selectedEvent', 'loading');

        return activityApi
            .fetchActivity(activityId)
            .then(event => {
                set({ selectedEvent: event });
            })
            .catch((error: unknown) => {
                set({ selectedEvent: null });
                return Promise.reject(error);
            })
            .finally(() => {
                setLoading('activity', 'selectedEvent', 'fetched');
            });
    },

    fetchSetActivitySubevents: ({ parentActivityId, category }) => {
        const { setLoading } = useLoadingStore.getState();

        set({
            subevents: [],
            subeventsNextCursor: null,
            hasMoreSubevents: true,
            subeventsParentId: parentActivityId,
            subeventsCategory: category ?? null,
        });
        setLoading('activity', 'subeventsData', 'loading');
        setLoading('activity', 'subeventsNextPage', 'fetched');

        return activityApi
            .fetchActivityChildren({
                parentActivityId,
                category,
                limit: ACTIVITY_API_LIMIT,
            })
            .then(data => {
                set({
                    subevents: data.items,
                    subeventsNextCursor: data.nextCursor,
                    hasMoreSubevents: data.nextCursor !== null,
                });
                setLoading('activity', 'subeventsData', 'fetched');
            })
            .catch((error: unknown) => {
                set({
                    subevents: [],
                    subeventsNextCursor: null,
                    hasMoreSubevents: false,
                    subeventsParentId: null,
                });
                setLoading('activity', 'subeventsData', 'fetched');
                return Promise.reject(error);
            });
    },

    fetchMoreActivitySubevents: () => {
        const { subeventsNextCursor, subeventsParentId, subeventsCategory } = get();
        const { setLoading, activity } = useLoadingStore.getState();

        if (
            subeventsNextCursor === null ||
            !subeventsParentId ||
            activity.subeventsNextPage === 'loading'
        ) {
            return Promise.resolve();
        }

        setLoading('activity', 'subeventsNextPage', 'loading');

        return activityApi
            .fetchActivityChildren({
                parentActivityId: subeventsParentId,
                category: subeventsCategory ?? undefined,
                limit: ACTIVITY_API_LIMIT,
                cursor: subeventsNextCursor,
            })
            .then(data => {
                set(currentState => ({
                    subevents: [...currentState.subevents, ...data.items],
                    subeventsNextCursor: data.nextCursor,
                    hasMoreSubevents: data.nextCursor !== null,
                }));
                setLoading('activity', 'subeventsNextPage', 'fetched');
            })
            .catch((error: unknown) => {
                setLoading('activity', 'subeventsNextPage', 'fetched');
                return Promise.reject(error);
            });
    },

    setSelectedEvent: event => {
        set({ selectedEvent: event });
    },

    resetActivitySubevents: () => {
        const { setLoading } = useLoadingStore.getState();
        set({
            subevents: initialState.subevents,
            subeventsNextCursor: initialState.subeventsNextCursor,
            hasMoreSubevents: initialState.hasMoreSubevents,
            subeventsParentId: initialState.subeventsParentId,
            subeventsCategory: initialState.subeventsCategory,
        });
        setLoading('activity', 'subeventsData', 'fetched');
        setLoading('activity', 'subeventsNextPage', 'fetched');
    },

    createExpense: input => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('expense', 'add', 'loading');

        return ledgerApi
            .createExpense(input)
            .then(() => undefined)
            .finally(() => {
                setLoading('expense', 'add', 'fetched');
            });
    },

    createSettlement: input => {
        const { setLoading } = useLoadingStore.getState();
        const { setSettlementWithFriend } = useUsersStore.getState();
        setLoading('settlement', 'add', 'loading');

        return ledgerApi
            .createSettlement(input)
            .then(() => {
                setSettlementWithFriend(input);
            })
            .finally(() => {
                setLoading('settlement', 'add', 'fetched');
            });
    },

    removeLedgerEntry: entryId => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('ledger', 'remove', 'loading');

        return ledgerApi.removeLedgerEntry({ entryId }).finally(() => {
            setLoading('ledger', 'remove', 'fetched');
        });
    },

    resetActivity: () => {
        const { setLoading } = useLoadingStore.getState();
        set(initialState);
        setLoading('activity', 'subeventsData', 'fetched');
        setLoading('activity', 'subeventsNextPage', 'fetched');
    },
}));

export { useActivityStore };
