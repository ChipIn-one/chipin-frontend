import { expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { SharingMode } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import {
    mapActivityExpenseToModalState,
} from './expenseModalEditMapping';
import type { ExpenseModalSource } from './expenseModalStore';

type ExpenseActivityEvent = Extract<AppEvent, { subjectType: 'expense' }>;

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
};
const knownFriend = {
    id: 'user-2',
    displayName: 'Friend',
    picture: null,
};

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

const createExpenseEvent = ({
    id,
    seq,
    action = ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    description = 'Dinner',
    amount = 120,
    category = 'food',
    subcategory = 'restaurants',
    payerId = 'user-1',
    payerDisplayName = 'You',
    sharingMode = null,
    shares = [
        {
            userId: 'user-1',
            displayName: 'You',
            shareAmount: 60,
            currency: 'USD',
        },
        {
            userId: 'user-2',
            displayName: 'Friend',
            shareAmount: 60,
            currency: 'USD',
        },
    ],
}: {
    id: string;
    seq: number;
    action?:
        | typeof ACTIVITY_ACTIONS.EXPENSE_CREATED
        | typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED
        | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    description?: string;
    amount?: number;
    category?: string;
    subcategory?: string;
    payerId?: string;
    payerDisplayName?: string;
    sharingMode?: SharingMode | null;
    shares?: Array<{
        userId: string;
        displayName: string;
        shareAmount: number;
        currency: string;
    }>;
}): ExpenseActivityEvent => ({
    id,
    seq,
    domain: 'LEDGER',
    action,
    actorUserId: 'user-1',
    actorSnapshot: { displayName: 'You', picture: null },
    subjectType: 'expense',
    subjectId: 'entry-1',
    groupId: 'group-1',
    metadata: {
        type: 'expense',
        entryId: 'entry-1',
        groupId: 'group-1',
        groupName: 'Weekend trip',
        description,
        amount,
        currency: 'USD',
        category,
        subcategory,
        payerId,
        payerDisplayName,
        sharingMode,
        shares,
    },
    createdAt: 1_700_000_000 + seq,
    parentActivityId: action === ACTIVITY_ACTIONS.EXPENSE_CREATED ? null : 'activity-1',
});

const parentEvent = createExpenseEvent({
    id: 'activity-1',
    seq: 1,
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
});

test('maps the latest Activity Expense snapshot without a canonical ledger entry', () => {
    const latestEvent = createExpenseEvent({
        id: 'activity-7',
        seq: 7,
        description: 'Updated dinner',
        amount: 150,
        payerId: 'former-user',
        payerDisplayName: 'Former participant',
        shares: [
            {
                userId: 'user-1',
                displayName: 'You',
                shareAmount: 75,
                currency: 'USD',
            },
            {
                userId: 'former-user',
                displayName: 'Former participant',
                shareAmount: 75,
                currency: 'USD',
            },
        ],
    });

    const result = mapActivityExpenseToModalState({
        parentEvent,
        childEvents: [latestEvent],
        source,
        parentActivityId: parentEvent.id,
    });

    expect(result).toMatchObject({
        mode: 'edit',
        targetMode: 'group',
        groupId: 'group-1',
        description: 'Updated dinner',
        amount: '150',
        currency: 'USD',
        category: 'food',
        paidById: 'former-user',
        splitMode: EXPENSE_SPLIT_MODES.AMOUNTS,
        amountShares: {
            'user-1': '75',
            'former-user': '75',
        },
        editContext: {
            entryId: 'entry-1',
            groupId: 'group-1',
            groupName: 'Weekend trip',
            parentActivityId: 'activity-1',
            original: {
                category: 'food',
                subcategory: 'restaurants',
            },
        },
    });
    expect(result?.source.groups[0].members).toEqual(
        expect.arrayContaining([
            { id: 'former-user', displayName: 'Former participant' },
        ]),
    );
    expect(result?.source.groups[0].members[2]).not.toHaveProperty('email');
});

test.each([
    ['AUTO', { type: 'AUTO' }, EXPENSE_SPLIT_MODES.EQUAL],
    [
        'PERCENTAGE',
        { type: 'PERCENTAGE', percentageShares: { 'user-1': 25, 'user-2': 75 } },
        EXPENSE_SPLIT_MODES.PERCENT,
    ],
    [
        'EXACT',
        { type: 'EXACT', customShares: { 'user-1': 30, 'user-2': 90 } },
        EXPENSE_SPLIT_MODES.AMOUNTS,
    ],
    [
        'SHARES',
        { type: 'SHARES', shares: { 'user-1': 1, 'user-2': 2 } },
        EXPENSE_SPLIT_MODES.SHARES,
    ],
] as const)('reconstructs %s sharing mode', (_name, sharingMode, splitMode) => {
    const result = mapActivityExpenseToModalState({
        parentEvent,
        childEvents: [createExpenseEvent({ id: 'activity-2', seq: 2, sharingMode })],
        source,
    });

    expect(result?.splitMode).toBe(splitMode);
});

test('falls back to financially faithful exact amounts when sharing mode is missing', () => {
    const result = mapActivityExpenseToModalState({
        parentEvent,
        childEvents: [createExpenseEvent({ id: 'activity-2', seq: 2, sharingMode: null })],
        source,
    });

    expect(result?.splitMode).toBe(EXPENSE_SPLIT_MODES.AMOUNTS);
    expect(result?.amountShares).toMatchObject({
        'user-1': '60',
        'user-2': '60',
    });
});

test('maps a direct expense former participant into known friends', () => {
    const directParentEvent = {
        ...parentEvent,
        groupId: null,
        metadata: {
            ...parentEvent.metadata,
            groupId: null,
            groupName: null,
        },
    } satisfies AppEvent;
    const directChildEvent = {
        ...createExpenseEvent({
            id: 'activity-2',
            seq: 2,
            payerId: 'former-user',
            payerDisplayName: 'Former participant',
            shares: [
                {
                    userId: 'user-1',
                    displayName: 'You',
                    shareAmount: 60,
                    currency: 'USD',
                },
                {
                    userId: 'former-user',
                    displayName: 'Former participant',
                    shareAmount: 60,
                    currency: 'USD',
                },
            ],
        }),
        groupId: null,
        metadata: {
            ...createExpenseEvent({
                id: 'activity-2',
                seq: 2,
                payerId: 'former-user',
                payerDisplayName: 'Former participant',
                shares: [
                    {
                        userId: 'user-1',
                        displayName: 'You',
                        shareAmount: 60,
                        currency: 'USD',
                    },
                    {
                        userId: 'former-user',
                        displayName: 'Former participant',
                        shareAmount: 60,
                        currency: 'USD',
                    },
                ],
            }).metadata,
            groupId: null,
            groupName: null,
        },
    } satisfies AppEvent;

    const result = mapActivityExpenseToModalState({
        parentEvent: directParentEvent,
        childEvents: [directChildEvent],
        source: { ...source, groups: [], knownFriends: [knownFriend] },
    });

    expect(result?.targetMode).toBe('friends');
    expect(result?.source.knownFriends).toEqual(
        expect.arrayContaining([
            { id: 'former-user', displayName: 'Former participant' },
        ]),
    );
    expect(result?.paidById).toBe('former-user');
});
