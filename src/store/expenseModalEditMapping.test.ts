import { expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { ApiExpenseLedgerEntry, ApiUserResponse } from 'api/chipin.raw.types';
import type { SharingMode } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import {
    mapCanonicalExpenseToModalState,
} from './expenseModalEditMapping';
import type { ExpenseModalSource } from './expenseModalStore';

const createUser = (id: string, displayName: string): ApiUserResponse => ({
    id,
    email: `${id}@example.com`,
    displayName,
    firstName: displayName,
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
});

const currentUser = createUser('user-1', 'You');
const knownFriend = createUser('user-2', 'Friend');
const formerParticipant = createUser('user-3', 'Former participant');

const source: ExpenseModalSource = {
    context: 'dashboard',
    currentUser,
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    skipCategory: false,
    groups: [
        {
            id: 'group-1',
            name: 'Weekend trip',
            members: [currentUser, knownFriend],
        },
    ],
    knownFriends: [knownFriend],
    defaultGroupId: 'group-1',
};

const entry: ApiExpenseLedgerEntry = {
    id: 'entry-1',
    type: 'EXPENSE',
    scope: 'GROUP',
    groupId: 'group-1',
    systemAction: null,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_100,
    expense: {
        id: 'entry-1',
        description: 'Dinner',
        amount: 120,
        currency: 'USD',
        date: 1_700_000_000,
        payer: formerParticipant,
        groupId: 'group-1',
        participants: [currentUser, knownFriend, formerParticipant],
        participantShares: [
            { userId: currentUser.id, shareAmount: 30, currency: 'USD' },
            { userId: knownFriend.id, shareAmount: 40, currency: 'USD' },
            { userId: formerParticipant.id, shareAmount: 50, currency: 'USD' },
        ],
        category: 'food',
        subcategory: 'restaurants',
        creator: currentUser,
        createdAt: 1_700_000_000,
        updatedAt: 1_700_000_100,
    },
    settlement: null,
};

const createExpenseEvent = (
    seq: number,
    sharingMode: SharingMode | null,
): AppEvent => ({
    id: `activity-${seq}`,
    seq,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    actorUserId: currentUser.id,
    actorSnapshot: { displayName: currentUser.displayName, picture: null },
    subjectType: 'expense',
    subjectId: entry.id,
    groupId: entry.groupId,
    metadata: {
        type: 'expense',
        entryId: entry.id,
        groupId: entry.groupId,
        groupName: 'Weekend trip',
        description: entry.expense.description,
        amount: entry.expense.amount,
        currency: entry.expense.currency,
        category: entry.expense.category,
        sharingMode,
        payerId: entry.expense.payer.id,
        payerDisplayName: entry.expense.payer.displayName,
        shares: entry.expense.participantShares.map(share => ({
            ...share,
            displayName:
                entry.expense.participants.find(user => user.id === share.userId)
                    ?.displayName ?? 'Unknown participant',
        })),
    },
    createdAt: 1_700_000_000 + seq,
    parentActivityId: 'parent-1',
});

test('maps canonical expense data and the highest-seq activity mode into edit state', () => {
    const result = mapCanonicalExpenseToModalState({
        entry,
        source,
        parentActivityId: 'parent-1',
        activityEvents: [
            createExpenseEvent(9, { type: 'EXACT', customShares: { [currentUser.id]: 30 } }),
            createExpenseEvent(3, { type: 'AUTO' }),
        ],
    });

    expect(result).toMatchObject({
        mode: 'edit',
        targetMode: 'group',
        groupId: 'group-1',
        description: 'Dinner',
        amount: '120',
        currency: 'USD',
        category: 'food',
        paidById: formerParticipant.id,
        date: entry.expense.date,
        splitMode: EXPENSE_SPLIT_MODES.AMOUNTS,
        amountShares: {
            [currentUser.id]: '30',
        },
        editContext: {
            entryId: entry.id,
            groupId: 'group-1',
            groupName: 'Weekend trip',
            parentActivityId: 'parent-1',
        },
    });
    expect(result.source.groups[0].members.map(user => user.id)).toEqual([
        currentUser.id,
        knownFriend.id,
        formerParticipant.id,
    ]);
    expect(result.includedParticipantIds).toEqual({
        [currentUser.id]: true,
        [knownFriend.id]: true,
        [formerParticipant.id]: true,
    });
});

test.each([
    [
        'AUTO',
        { type: 'AUTO' },
        EXPENSE_SPLIT_MODES.EQUAL,
    ],
    [
        'PERCENTAGE',
        { type: 'PERCENTAGE', percentageShares: { 'user-1': 25, 'user-2': 75 } },
        EXPENSE_SPLIT_MODES.PERCENT,
    ],
    [
        'EXACT',
        { type: 'EXACT', customShares: { 'user-1': 30, 'user-2': 40, 'user-3': 50 } },
        EXPENSE_SPLIT_MODES.AMOUNTS,
    ],
    [
        'SHARES',
        { type: 'SHARES', shares: { 'user-1': 1, 'user-2': 2, 'user-3': 3 } },
        EXPENSE_SPLIT_MODES.SHARES,
    ],
] as const)('reconstructs %s sharing mode', (_name, sharingMode, splitMode) => {
    const result = mapCanonicalExpenseToModalState({
        entry,
        source,
        activityEvents: [createExpenseEvent(10, sharingMode)],
    });

    expect(result.splitMode).toBe(splitMode);
});

test('falls back to financially faithful exact amounts when activity mode is missing', () => {
    const result = mapCanonicalExpenseToModalState({
        entry,
        source,
        activityEvents: [createExpenseEvent(10, null)],
    });

    expect(result.splitMode).toBe(EXPENSE_SPLIT_MODES.AMOUNTS);
    expect(result.amountShares).toMatchObject({
        [currentUser.id]: '30',
        [knownFriend.id]: '40',
        [formerParticipant.id]: '50',
    });
});

test('merges a former direct-expense payer and participant into the local source', () => {
    const directEntry: ApiExpenseLedgerEntry = {
        ...entry,
        scope: 'USER',
        groupId: null,
        expense: {
            ...entry.expense,
            groupId: null,
            payer: formerParticipant,
            participants: [currentUser, formerParticipant],
            participantShares: [
                { userId: currentUser.id, shareAmount: 60, currency: 'USD' },
                { userId: formerParticipant.id, shareAmount: 60, currency: 'USD' },
            ],
        },
    };

    const result = mapCanonicalExpenseToModalState({
        entry: directEntry,
        source: { ...source, groups: [], knownFriends: [knownFriend] },
        activityEvents: [createExpenseEvent(10, { type: 'AUTO' })],
    });

    expect(result.targetMode).toBe('friends');
    expect(result.source.knownFriends.map(user => user.id)).toEqual([
        knownFriend.id,
        formerParticipant.id,
    ]);
    expect(result.paidById).toBe(formerParticipant.id);
});
