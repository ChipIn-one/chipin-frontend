import { create } from 'zustand';

import { AppEvent } from 'api/activity.types';
import {
    createApiExpense,
    deleteApiLedgerEntry,
    fetchApiUserActivities,
    fetchApiUserActivityChildren,
} from 'api/chipin';
import type { ActivityCategory } from 'api/chipin.types';
import {
    CreateLedgerEntryParams as CreateExpenseParams,
} from 'api/chipin.types';

import { useLoadingStore } from './loadingStore';

const ACTIVITY_PAGE_LIMIT = 15;

interface FetchSetChildActivityParams {
    parentActivityId: string;
    category?: ActivityCategory;
}

export interface ActivityStore {
    items: AppEvent[];
    nextCursor: number | null;
    hasMore: boolean;
    childItems: AppEvent[];
    childNextCursor: number | null;
    childHasMore: boolean;
    childParentActivityId: string | null;
    childCategory: ActivityCategory | null;
    childRequestSeq: number;

    fetchSetActivity: () => void;
    fetchMoreActivity: () => void;
    fetchSetChildActivity: (params: FetchSetChildActivityParams) => void;
    fetchMoreChildActivity: () => void;
    createExpense: (params: CreateExpenseParams) => Promise<void>;
    deleteLedgerEntry: (entryId: string) => Promise<void>;
    setInitialChildActivityStore: () => void;
    setInitialActivityStore: () => void;
}

const initialActivityStore = {
    items: [],
    nextCursor: null,
    hasMore: true,
};

const initialChildActivityStore = {
    childItems: [],
    childNextCursor: null,
    childHasMore: true,
    childParentActivityId: null,
    childCategory: null,
    childRequestSeq: 0,
};

export const useActivityStore = create<ActivityStore>((set, get) => ({
    ...initialActivityStore,
    ...initialChildActivityStore,

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

    fetchSetChildActivity: ({ parentActivityId, category }) => {
        const { setLoading } = useLoadingStore.getState();
        const requestedCategory = category ?? null;
        const requestedSeq = get().childRequestSeq + 1;

        set({
            childItems: [],
            childNextCursor: null,
            childHasMore: true,
            childParentActivityId: parentActivityId,
            childCategory: requestedCategory,
            childRequestSeq: requestedSeq,
        });
        setLoading('activity', 'childData', 'loading');
        setLoading('activity', 'childNextPage', 'fetched');

        fetchApiUserActivityChildren({
            parentActivityId,
            category,
            limit: ACTIVITY_PAGE_LIMIT,
        })
            .then(data => {
                const { childParentActivityId, childCategory, childRequestSeq } = get();

                if (
                    childParentActivityId !== parentActivityId ||
                    childCategory !== requestedCategory ||
                    childRequestSeq !== requestedSeq
                ) {
                    return;
                }

                set({
                    childItems: data.items,
                    childNextCursor: data.nextCursor,
                    childHasMore: data.nextCursor !== null,
                    childParentActivityId: parentActivityId,
                    childCategory: requestedCategory,
                });
                setLoading('activity', 'childData', 'fetched');
            })
            .catch(() => {
                const { childParentActivityId, childCategory, childRequestSeq } = get();

                if (
                    childParentActivityId !== parentActivityId ||
                    childCategory !== requestedCategory ||
                    childRequestSeq !== requestedSeq
                ) {
                    return;
                }

                set({
                    childItems: [],
                    childNextCursor: null,
                    childHasMore: false,
                    childParentActivityId: parentActivityId,
                    childCategory: requestedCategory,
                });
                setLoading('activity', 'childData', 'fetched');
            });
    },

    fetchMoreChildActivity: () => {
        const { childNextCursor, childParentActivityId, childCategory, childRequestSeq } = get();
        const { setLoading, activity } = useLoadingStore.getState();

        if (!childNextCursor || !childParentActivityId || activity.childNextPage === 'loading') {
            return;
        }

        const requestedCursor = childNextCursor;
        const requestedParentActivityId = childParentActivityId;
        const requestedCategory = childCategory;
        const requestedSeq = childRequestSeq;

        setLoading('activity', 'childNextPage', 'loading');

        fetchApiUserActivityChildren({
            parentActivityId: requestedParentActivityId,
            category: requestedCategory ?? undefined,
            limit: ACTIVITY_PAGE_LIMIT,
            cursor: requestedCursor,
        })
            .then(data => {
                let isCurrentRequest = false;

                set(state => {
                    if (
                        state.childParentActivityId !== requestedParentActivityId ||
                        state.childCategory !== requestedCategory ||
                        state.childNextCursor !== requestedCursor ||
                        state.childRequestSeq !== requestedSeq
                    ) {
                        return state;
                    }

                    isCurrentRequest = true;

                    return {
                        childItems: [...state.childItems, ...data.items],
                        childNextCursor: data.nextCursor,
                        childHasMore: data.nextCursor !== null,
                    };
                });

                if (isCurrentRequest) {
                    setLoading('activity', 'childNextPage', 'fetched');
                }
            })
            .catch(() => {
                const currentState = get();

                if (
                    currentState.childParentActivityId === requestedParentActivityId &&
                    currentState.childCategory === requestedCategory &&
                    currentState.childNextCursor === requestedCursor &&
                    currentState.childRequestSeq === requestedSeq
                ) {
                    setLoading('activity', 'childNextPage', 'fetched');
                }
            });
    },

    setInitialChildActivityStore: () => {
        set({
            ...initialChildActivityStore,
            childRequestSeq: get().childRequestSeq + 1,
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

    deleteLedgerEntry: entryId => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('ledger', 'remove', 'loading');

        return deleteApiLedgerEntry({ entryId }).finally(() => {
            setLoading('ledger', 'remove', 'fetched');
        });
    },

    setInitialActivityStore: () => {
        set({
            ...initialActivityStore,
            ...initialChildActivityStore,
            childRequestSeq: get().childRequestSeq + 1,
        });
    },
}));
