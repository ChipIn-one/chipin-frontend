import { expect, test, vi } from 'vitest';

import { selectActivitySubeventsFlow } from './selectors';
import type { ActivityStore } from './types';

const createStore = (): ActivityStore => ({
    subevents: [],
    subeventsParent: null,
    subeventsNextCursor: null,
    hasMoreSubevents: false,
    subeventsCategory: null,
    createExpense: vi.fn(() => Promise.resolve()),
    prepareExpenseEdit: vi.fn(() => null),
    updateExpense: vi.fn(() => Promise.resolve()),
    createSettlement: vi.fn(() => Promise.resolve()),
    reverseLedgerEntry: vi.fn(() => Promise.resolve()),
    fetchSetActivity: vi.fn(() => Promise.resolve()),
    fetchSetActivitySubevents: vi.fn(() => Promise.resolve()),
    fetchMoreActivitySubevents: vi.fn(() => Promise.resolve()),
    resetActivitySubevents: vi.fn(),
    resetActivity: vi.fn(),
});

test('selects the complete activity subevents flow', () => {
    const state = createStore();

    expect(selectActivitySubeventsFlow(state)).toEqual({
        subevents: state.subevents,
        subeventsParent: state.subeventsParent,
        hasMoreSubevents: false,
        fetchSetActivitySubevents: state.fetchSetActivitySubevents,
        fetchMoreActivitySubevents: state.fetchMoreActivitySubevents,
    });
});
