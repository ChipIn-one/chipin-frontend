import type { ActivityStoreState } from './types';

const initialState: ActivityStoreState = {
    subevents: [],
    subeventsParent: null,
    subeventsNextCursor: null,
    hasMoreSubevents: true,
    subeventsCategory: null,
};

export { initialState };
