import { beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import * as activityApi from 'api/activityApi';
import {
    ACTIVITY_ACTIONS,
    ACTIVITY_CATEGORIES,
} from 'constants/activity';

import { useLoadingStore } from '../loadingStore';

import { useActivityStore } from './actions';
import { initialState } from './initialState';

vi.mock('api/activityApi', () => ({
    fetchActivities: vi.fn(),
    fetchActivity: vi.fn(),
    fetchActivityChildren: vi.fn(),
}));

vi.mock('api/ledgerApi', () => ({
    createExpense: vi.fn(),
    createSettlement: vi.fn(),
    removeLedgerEntry: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    useActivityStore.setState(initialState);
    useLoadingStore.getState().setInitialLoadingStore();
});

test('resets activity state', () => {
    useActivityStore.setState({
        nextCursor: 25,
        hasMore: false,
        subeventsNextCursor: 40,
        subeventsParentId: 'parent-1',
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
    });

    useActivityStore.getState().resetActivity();

    expect(useActivityStore.getState()).toMatchObject(initialState);
});

test('fetches and selects one activity', () => {
    const event = {
        id: 'activity-1',
        seq: 1,
        domain: 'LEDGER',
        action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
        actorUserId: 'user-1',
        actorSnapshot: {
            displayName: 'Alex',
            picture: null,
        },
        subjectType: 'expense',
        subjectId: 'expense-1',
        groupId: null,
        metadata: {
            type: 'expense',
            entryId: 'expense-1',
            groupId: null,
            groupName: null,
            description: 'Dinner',
            amount: 30,
            currency: 'USD',
            payerId: 'user-1',
            payerDisplayName: 'Alex',
            shares: [],
            fieldDiffs: [],
        },
        createdAt: 1_785_328_628,
        parentActivityId: null,
    } satisfies AppEvent;
    vi.mocked(activityApi.fetchActivity).mockResolvedValue(event);

    return useActivityStore
        .getState()
        .fetchSetSelectedEvent(event.id)
        .then(() => {
            expect(activityApi.fetchActivity).toHaveBeenCalledWith(event.id);
            expect(useActivityStore.getState().selectedEvent).toBe(event);
            expect(useLoadingStore.getState().activity.selectedEvent).toBe(
                'fetched',
            );
        });
});

test('rejects when fetching the selected activity fails', () => {
    const requestError = new Error('Activity unavailable');
    vi.mocked(activityApi.fetchActivity).mockRejectedValue(requestError);

    return useActivityStore
        .getState()
        .fetchSetSelectedEvent('activity-1')
        .then(
            () => Promise.reject(new Error('Expected activity fetch to reject')),
            error => {
                expect(error).toBe(requestError);
                expect(useActivityStore.getState().selectedEvent).toBeNull();
                expect(useLoadingStore.getState().activity.selectedEvent).toBe(
                    'fetched',
                );
            },
        );
});

test('rejects when fetching activity subevents fails', () => {
    const requestError = new Error('Subevents unavailable');
    vi.mocked(activityApi.fetchActivityChildren).mockRejectedValue(
        requestError,
    );

    return useActivityStore
        .getState()
        .fetchSetActivitySubevents({
            parentActivityId: 'activity-1',
            category: ACTIVITY_CATEGORIES.EXPENSE,
        })
        .then(
            () => Promise.reject(new Error('Expected subevents fetch to reject')),
            error => {
                expect(error).toBe(requestError);
                expect(useActivityStore.getState()).toMatchObject({
                    subevents: [],
                    hasMoreSubevents: false,
                    subeventsParentId: null,
                });
                expect(useLoadingStore.getState().activity.subeventsData).toBe(
                    'fetched',
                );
            },
        );
});

test('preserves subevent pagination after a page request fails', () => {
    const requestError = new Error('Next page unavailable');
    vi.mocked(activityApi.fetchActivityChildren).mockRejectedValue(requestError);
    useActivityStore.setState({
        subeventsNextCursor: 40,
        subeventsParentId: 'activity-1',
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
        hasMoreSubevents: true,
    });

    return useActivityStore
        .getState()
        .fetchMoreActivitySubevents()
        .then(
            () => Promise.reject(new Error('Expected pagination to reject')),
            error => {
                expect(error).toBe(requestError);
                expect(useActivityStore.getState()).toMatchObject({
                    subeventsNextCursor: 40,
                    hasMoreSubevents: true,
                });
                expect(
                    useLoadingStore.getState().activity
                        .subeventsNextPage,
                ).toBe('fetched');
            },
        );
});
