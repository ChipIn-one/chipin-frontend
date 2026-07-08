import { create } from 'zustand';

import { AppEvent } from 'api/activity.types';
import { createApiExpense, createApiSettlement, fetchApiUserActivities } from 'api/chipin';
import {
    CreateLedgerEntryParams as CreateExpenseParams,
    CreateSettlementParams,
} from 'api/chipin.types';

import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './usersStore';

const ACTIVITY_PAGE_LIMIT = 15;

export interface ActivityStore {
    items: AppEvent[];
    nextCursor: number | null;
    hasMore: boolean;

    fetchSetActivity: () => void;
    fetchMoreActivity: () => void;
    createExpense: (params: CreateExpenseParams) => Promise<void>;
    createSettlement: (params: CreateSettlementParams) => Promise<void>;
    setInitialActivityStore: () => void;
}

const initialActivityStore = {
    items: [],
    nextCursor: null,
    hasMore: true,
};

export const useActivityStore = create<ActivityStore>((set, get) => ({
    ...initialActivityStore,

    fetchSetActivity: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'data', 'loading');

        fetchApiUserActivities({ limit: ACTIVITY_PAGE_LIMIT })
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
            return;
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'nextPage', 'loading');

        fetchApiUserActivities({ limit: ACTIVITY_PAGE_LIMIT, cursor: nextCursor })
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

    createExpense: params => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('expense', 'add', 'loading');

        return createApiExpense(params)
            .then(() => undefined)
            .finally(() => {
                setLoading('expense', 'add', 'fetched');
            });
    },
    createSettlement: params => {
        const { setLoading } = useLoadingStore.getState();
        const { setSettlementWithFriend } = useUsersStore.getState();
        setLoading('settlement', 'add', 'loading');

        return createApiSettlement(params)
            .then(() => {
                setSettlementWithFriend(params);
            })
            .finally(() => {
                setLoading('settlement', 'add', 'fetched');
            });
    },
    setInitialActivityStore: () => {
        set(initialActivityStore);
    },
}));
