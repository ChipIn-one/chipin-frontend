import type { ActivityStoreState } from './types';

const initialState: ActivityStoreState = {
    items: [],
    nextCursor: null,
    hasMore: true,
    selectedEvent: null,
    subevents: [],
    subeventsNextCursor: null,
    hasMoreSubevents: true,
    subeventsParentId: null,
    subeventsCategory: null,
};

export { initialState };
