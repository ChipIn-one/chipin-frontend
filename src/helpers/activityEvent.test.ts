import { describe, expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import {
    getActivityCategory,
    getActivityLedgerEntryId,
    getActivitySubeventsView,
} from './activityEvent';

const expenseCreatedEvent = {
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: {
        displayName: 'User',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: 'entry-1',
    groupId: 'group-1',
    metadata: {
        type: 'expense',
        entryId: 'entry-1',
        groupId: 'group-1',
        groupName: 'Group',
        description: 'Dinner',
        amount: 10,
        currency: 'USD',
        payerId: 'user-1',
        payerDisplayName: 'User',
        shares: [],
    },
    createdAt: 1,
    parentActivityId: null,
} satisfies AppEvent;

const settlementCreatedEvent = {
    ...expenseCreatedEvent,
    action: ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
    subjectType: 'settlement',
    metadata: {
        type: 'settlement',
        entryId: 'entry-1',
        groupId: 'group-1',
        groupName: 'Group',
        amount: 10,
        currency: 'USD',
        actorUserId: 'user-1',
        payerId: 'user-1',
        fromDisplayName: 'User',
        toDisplayName: 'Friend',
    },
} satisfies AppEvent;

const expenseReversedEvent = {
    ...expenseCreatedEvent,
    action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
} satisfies AppEvent;

describe('activity event helpers', () => {
    test.each([
        { event: expenseCreatedEvent, category: 'expense' },
        { event: settlementCreatedEvent, category: 'settlement' },
    ] as const)('returns category and entry id for $category', ({ event, category }) => {
        expect(getActivityCategory(event)).toBe(category);
        expect(getActivityLedgerEntryId(event)).toBe('entry-1');
    });

    test('rejects activities that cannot own child events', () => {
        expect(getActivityCategory(expenseReversedEvent)).toBeUndefined();
        expect(getActivityLedgerEntryId(expenseReversedEvent)).toBeUndefined();
    });

    test('uses the parent as current state when no children are loaded', () => {
        expect(getActivitySubeventsView(expenseCreatedEvent, [])).toEqual({
            originalEvent: expenseCreatedEvent,
            currentEvent: expenseCreatedEvent,
        });
    });

    test('uses the highest-sequence child regardless of array order', () => {
        const olderChild = {
            ...expenseCreatedEvent,
            id: 'activity-2',
            seq: 2,
            parentActivityId: expenseCreatedEvent.id,
        } satisfies AppEvent;
        const newestChild = {
            ...expenseCreatedEvent,
            id: 'activity-7',
            seq: 7,
            parentActivityId: expenseCreatedEvent.id,
        } satisfies AppEvent;

        expect(getActivitySubeventsView(expenseCreatedEvent, [newestChild, olderChild])).toEqual({
            originalEvent: expenseCreatedEvent,
            currentEvent: newestChild,
        });
    });

    test('keeps the root event as original when the latest event is reversed', () => {
        const reversedChild = {
            ...expenseReversedEvent,
            id: 'activity-reversed',
            seq: 8,
            parentActivityId: expenseCreatedEvent.id,
        } satisfies AppEvent;

        expect(getActivitySubeventsView(expenseCreatedEvent, [reversedChild])).toEqual({
            originalEvent: expenseCreatedEvent,
            currentEvent: reversedChild,
        });
    });
});
