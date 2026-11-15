import { expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import type {
    ExpenseActivityAction,
    ExpenseActivityEvent,
    ExpenseSharingMode,
} from 'entities/activity';
import { currencyCode, fromUnits, type Money } from 'shared/money';
import { getOrThrow } from 'test/getOrThrow';

import { mapActivityExpenseToModalState } from './expenseModalEditMapping';
import type { ExpenseModalSource } from './expenseModalStore';

const usd = (units: bigint): Money => fromUnits(units, currencyCode('USD'));

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
    action = 'EXPENSE_UPDATED',
    description = 'Dinner',
    amount = usd(1_200_000n),
    category = 'food',
    subcategory = 'restaurants',
    payerId = 'user-1',
    payerDisplayName = 'You',
    sharingMode,
    shares = [
        { userId: 'user-1', displayName: 'You', shareAmount: usd(600_000n) },
        { userId: 'user-2', displayName: 'Friend', shareAmount: usd(600_000n) },
    ],
}: {
    id: string;
    seq: number;
    action?: ExpenseActivityAction;
    description?: string;
    amount?: Money;
    category?: string;
    subcategory?: string;
    payerId?: string;
    payerDisplayName?: string;
    sharingMode?: ExpenseSharingMode;
    shares?: { userId: string; displayName: string; shareAmount: Money }[];
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
        category,
        subcategory,
        payerId,
        payerDisplayName,
        shares,
        ...(sharingMode && { sharingMode }),
    },
    createdAt: 1_700_000_000 + seq,
    parentActivityId: action === 'EXPENSE_CREATED' ? null : 'activity-1',
});

const parentEvent = createExpenseEvent({
    id: 'activity-1',
    seq: 1,
    action: 'EXPENSE_CREATED',
});

test('maps the latest Activity Expense snapshot without a canonical ledger entry', () => {
    const latestEvent = createExpenseEvent({
        id: 'activity-7',
        seq: 7,
        description: 'Updated dinner',
        amount: usd(1_500_000n),
        payerId: 'former-user',
        payerDisplayName: 'Former participant',
        shares: [
            { userId: 'user-1', displayName: 'You', shareAmount: usd(750_000n) },
            {
                userId: 'former-user',
                displayName: 'Former participant',
                shareAmount: usd(750_000n),
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
    expect(getOrThrow(result?.source.groups ?? [], 0).members).toEqual(
        expect.arrayContaining([{ id: 'former-user', displayName: 'Former participant' }]),
    );
    expect(getOrThrow(result?.source.groups ?? [], 0).members[2]).not.toHaveProperty('email');
});

test.each<[string, ExpenseSharingMode, string, Record<string, unknown>]>([
    ['AUTO', { type: 'AUTO' }, EXPENSE_SPLIT_MODES.EQUAL, {}],
    [
        'PERCENTAGE',
        { type: 'PERCENTAGE', percentageShares: { 'user-1': '25.0000', 'user-2': '75' } },
        EXPENSE_SPLIT_MODES.PERCENT,
        { percentShares: { 'user-1': '25', 'user-2': '75' } },
    ],
    [
        'EXACT',
        { type: 'EXACT', customShares: { 'user-1': usd(300_000n), 'user-2': usd(901_234n) } },
        EXPENSE_SPLIT_MODES.AMOUNTS,
        { amountShares: { 'user-1': '30', 'user-2': '90.1234' } },
    ],
    [
        'SHARES',
        { type: 'SHARES', shares: { 'user-1': '1', 'user-2': '2.5000' } },
        EXPENSE_SPLIT_MODES.SHARES,
        { shareWeights: { 'user-1': '1', 'user-2': '2.5' } },
    ],
])(
    'ACT-004 reconstructs the %s sharing mode and its form texts',
    (_name, sharingMode, splitMode, texts) => {
        const result = mapActivityExpenseToModalState({
            parentEvent,
            childEvents: [createExpenseEvent({ id: 'activity-2', seq: 2, sharingMode })],
            source,
        });

        expect(result?.splitMode).toBe(splitMode);
        expect(result).toMatchObject(texts);
    },
);

test('ACT-004 the original keeps Money and the shortest decimal text, so an unchanged edit is unchanged', () => {
    const result = mapActivityExpenseToModalState({
        parentEvent,
        childEvents: [
            createExpenseEvent({
                id: 'activity-2',
                seq: 2,
                amount: usd(1_000_500n),
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { 'user-1': '33.3300', 'user-2': '66.67' },
                },
            }),
        ],
        source,
    });

    expect(result?.amount).toBe('100.05');
    expect(result?.editContext.original).toMatchObject({
        amount: usd(1_000_500n),
        currency: 'USD',
        sharingMode: {
            type: 'PERCENTAGE',
            percentageShares: { 'user-1': '33.33', 'user-2': '66.67' },
        },
    });
});

test('falls back to financially faithful exact amounts when sharing mode is missing', () => {
    const result = mapActivityExpenseToModalState({
        parentEvent,
        childEvents: [createExpenseEvent({ id: 'activity-2', seq: 2 })],
        source,
    });

    expect(result?.splitMode).toBe(EXPENSE_SPLIT_MODES.AMOUNTS);
    expect(result?.amountShares).toMatchObject({
        'user-1': '60',
        'user-2': '60',
    });
});

test('maps a direct expense former participant into known friends', () => {
    const directParentEvent: ExpenseActivityEvent = {
        ...parentEvent,
        groupId: null,
        metadata: { ...parentEvent.metadata, groupId: null, groupName: null },
    };
    const childEvent = createExpenseEvent({
        id: 'activity-2',
        seq: 2,
        payerId: 'former-user',
        payerDisplayName: 'Former participant',
        shares: [
            { userId: 'user-1', displayName: 'You', shareAmount: usd(600_000n) },
            {
                userId: 'former-user',
                displayName: 'Former participant',
                shareAmount: usd(600_000n),
            },
        ],
    });
    const directChildEvent: ExpenseActivityEvent = {
        ...childEvent,
        groupId: null,
        metadata: { ...childEvent.metadata, groupId: null, groupName: null },
    };

    const result = mapActivityExpenseToModalState({
        parentEvent: directParentEvent,
        childEvents: [directChildEvent],
        source: { ...source, groups: [], knownFriends: [knownFriend] },
    });

    expect(result?.targetMode).toBe('friends');
    expect(result?.source.knownFriends).toEqual(
        expect.arrayContaining([{ id: 'former-user', displayName: 'Former participant' }]),
    );
    expect(result?.paidById).toBe('former-user');
});
