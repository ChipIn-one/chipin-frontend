import { expect, test, vi } from 'vitest';

import { selectActivityFeed, selectActivitySubeventsFlow } from './selectors';
import type { ActivityStore } from './types';

const createStore = (): ActivityStore => ({
    items: [],
    nextCursor: null,
    hasMore: true,
    selectedEvent: null,
    subevents: [],
    subeventsNextCursor: null,
    hasMoreSubevents: false,
    subeventsParentId: 'parent-1',
    subeventsCategory: null,
    fetchSetActivity: vi.fn(() => Promise.resolve()),
    fetchMoreActivity: vi.fn(() => Promise.resolve()),
    fetchSetSelectedEvent: vi.fn(() => Promise.resolve()),
    fetchSetActivitySubevents: vi.fn(() => Promise.resolve()),
    fetchMoreActivitySubevents: vi.fn(() => Promise.resolve()),
    setSelectedEvent: vi.fn(),
    createExpense: vi.fn(() => Promise.resolve()),
    createSettlement: vi.fn(() => Promise.resolve()),
    removeLedgerEntry: vi.fn(() => Promise.resolve()),
    resetActivitySubevents: vi.fn(),
    resetActivity: vi.fn(),
});

test('selects the activity feed slice', () => {
    const state = createStore();

    expect(selectActivityFeed(state)).toEqual({
        items: state.items,
        hasMore: true,
    });
});

test('selects the complete activity subevents flow', () => {
    const state = createStore();

    expect(selectActivitySubeventsFlow(state)).toEqual({
        subevents: state.subevents,
        hasMoreSubevents: false,
        subeventsParentId: 'parent-1',
        fetchSetActivitySubevents: state.fetchSetActivitySubevents,
        fetchMoreActivitySubevents: state.fetchMoreActivitySubevents,
    });
});
