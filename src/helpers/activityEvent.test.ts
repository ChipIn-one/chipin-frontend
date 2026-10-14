import { describe, expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import {
    getActivityCategory,
    getActivityLedgerEntryId,
    getActivityPreviewEvents,
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

    test('ACT-021 preserves preview parent chronology and latest event', () => {
        const updated = {
            ...expenseCreatedEvent,
            id: 'updated-activity',
            action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
            createdAt: 10,
            parentActivityId: expenseCreatedEvent.id,
        } satisfies AppEvent;
        const item = { parent: expenseCreatedEvent, lastEvent: updated };

        expect(getActivityPreviewEvents([item])).toEqual([item]);
    });

    test('ACT-022 excludes reversed chains and de-duplicates repeated parent previews', () => {
        const repeated = { parent: expenseCreatedEvent, lastEvent: expenseCreatedEvent };
        const reversed = {
            parent: { ...expenseCreatedEvent, id: 'second-parent' },
            lastEvent: expenseReversedEvent,
        };

        expect(getActivityPreviewEvents([repeated, reversed, repeated])).toEqual([repeated]);
    });

    test('uses the parent as current state when no children are loaded', () => {
        expect(getActivitySubeventsView(expenseCreatedEvent, [])).toEqual({
            originalEvent: expenseCreatedEvent,
            currentEvent: expenseCreatedEvent,
        });
    });

    test('ACT-002 uses the highest-sequence child regardless of array order', () => {
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

    test('ACT-022 suppresses an earlier active duplicate when a later page contains its reversal', () => {
        const parent = expenseCreatedEvent;
        const reversedChild = {
            ...expenseReversedEvent,
            id: 'reversed-child',
            seq: 5,
            parentActivityId: parent.id,
        } satisfies AppEvent;
        const another = {
            ...settlementCreatedEvent,
            id: 'unrelated-parent',
        } satisfies AppEvent;
        const original = { parent, lastEvent: parent };
        const reversed = { parent, lastEvent: reversedChild };
        const unrelated = { parent: another, lastEvent: another };

        expect(getActivityPreviewEvents([original, unrelated, reversed]))
            .toEqual([unrelated]);
        expect(getActivityPreviewEvents([reversed, unrelated, original]))
            .toEqual([unrelated]);
    });

    test('ACT-021 keeps parent ordering while selecting the latest duplicate edit', () => {
        const parent = expenseCreatedEvent;
        const edited = {
            ...expenseCreatedEvent,
            id: 'edited-child',
            action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
            seq: 4,
            parentActivityId: parent.id,
        } satisfies AppEvent;
        const other = {
            ...settlementCreatedEvent,
            id: 'other-parent',
        } satisfies AppEvent;

        expect(getActivityPreviewEvents([
            { parent, lastEvent: parent },
            { parent: other, lastEvent: other },
            { parent, lastEvent: edited },
        ])).toEqual([
            { parent, lastEvent: edited },
            { parent: other, lastEvent: other },
        ]);
    });
