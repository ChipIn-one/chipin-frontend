import type { ActivityStoreState } from './types';

const initialState: ActivityStoreState = {
    items: [],
    nextCursor: null,
    hasMore: true,
    subevents: [],
    subeventsParent: null,
    subeventsNextCursor: null,
    hasMoreSubevents: true,
    subeventsCategory: null,
};

export { initialState };
