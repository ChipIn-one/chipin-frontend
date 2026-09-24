import { describe, expect, it } from 'vitest';

import { parseActivityPreviewPage, parseLedgerEntry } from './core-guards';

const userA = {
    id: 'user-a',
    email: 'user-a@contract-test.chipin.local',
    displayName: 'User A',
    createdAt: 1,
    updatedAt: 1,
};

const userB = {
    id: 'user-b',
    email: 'user-b@contract-test.chipin.local',
    displayName: 'User B',
    createdAt: 1,
    updatedAt: 1,
};

describe('parseLedgerEntry', () => {
    it('retains the validated expense scope', () => {
        const entry = parseLedgerEntry({
            id: 'expense-id',
            type: 'EXPENSE',
            scope: 'GROUP',
            groupId: 'group-id',
            createdAt: 1,
            updatedAt: 1,
            expense: {
                amount: 12.5,
                currency: 'USD',
                date: 1,
                payer: userA,
                participants: [userA, userB],
                participantShares: [
                    { userId: userA.id, shareAmount: 6.25, currency: 'USD' },
                    { userId: userB.id, shareAmount: 6.25, currency: 'USD' },
                ],
                creator: userA,
            },
            settlement: null,
        });

        expect(entry).toMatchObject({ scope: 'GROUP' });
    });

    it('retains the validated settlement scope', () => {
        const entry = parseLedgerEntry({
            id: 'settlement-id',
            type: 'SETTLEMENT',
            scope: 'USER',
            groupId: null,
            createdAt: 1,
            updatedAt: 1,
            expense: null,
            settlement: {
                fromUser: userA,
                toUser: userB,
                amount: 5,
                currency: 'USD',
                settledAt: 1,
            },
        });

        expect(entry).toMatchObject({ scope: 'USER' });
    });

    it('normalizes an omitted groupId for a user-scoped entry', () => {
        const entry = parseLedgerEntry({
            id: 'direct-expense-id',
            type: 'EXPENSE',
            scope: 'USER',
            createdAt: 1,
            updatedAt: 1,
            expense: {
                amount: 8,
                currency: 'USD',
                date: 1,
                payer: userA,
                participants: [userA, userB],
                participantShares: [
                    { userId: userA.id, shareAmount: 4, currency: 'USD' },
                    { userId: userB.id, shareAmount: 4, currency: 'USD' },
                ],
                creator: userA,
            },
            settlement: null,
        });

        expect(entry).toMatchObject({ scope: 'USER', groupId: null });
    });

    it('requires groupId for a group-scoped entry', () => {
        expect(() =>
            parseLedgerEntry({
                id: 'group-expense-id',
                type: 'EXPENSE',
                scope: 'GROUP',
                createdAt: 1,
                updatedAt: 1,
                expense: {
                    amount: 8,
                    currency: 'USD',
                    date: 1,
                    payer: userA,
                    participants: [userA, userB],
                    participantShares: [
                        { userId: userA.id, shareAmount: 4, currency: 'USD' },
                        { userId: userB.id, shareAmount: 4, currency: 'USD' },
                    ],
                    creator: userA,
                },
                settlement: null,
            }),
        ).toThrow('ledger.groupId must be a non-empty string for GROUP scope');
    });

    it('rejects an empty groupId for a group-scoped entry', () => {
        expect(() =>
            parseLedgerEntry({
                id: 'group-expense-id',
                type: 'EXPENSE',
                scope: 'GROUP',
                groupId: '',
                createdAt: 1,
                updatedAt: 1,
                expense: {
                    amount: 8,
                    currency: 'USD',
                    date: 1,
                    payer: userA,
                    participants: [userA, userB],
                    participantShares: [
                        { userId: userA.id, shareAmount: 4, currency: 'USD' },
                        { userId: userB.id, shareAmount: 4, currency: 'USD' },
                    ],
                    creator: userA,
                },
                settlement: null,
            }),
        ).toThrow('ledger.groupId must be a non-empty string');
    });
});

describe('parseActivityPreviewPage', () => {
    it('accepts group lifecycle previews without treating them as ledger activity', () => {
        const parent = {
            id: 'group-created',
            seq: 1,
            domain: 'GROUP',
            action: 'GROUP_CREATED',
            actorSnapshot: { displayName: 'Owner', picture: null },
            subjectType: 'group',
            subjectId: 'group-id',
            metadata: {
                type: 'group',
                groupId: 'group-id',
                groupName: 'Contract Group',
            },
            createdAt: 1,
        };
        const lastEvent = {
            ...parent,
            id: 'group-updated',
            seq: 2,
            action: 'GROUP_UPDATED',
            createdAt: 2,
        };

        expect(
            parseActivityPreviewPage({
                items: [{ parent, lastEvent }],
                nextCursor: null,
            }),
        ).toEqual({
            ids: ['group-created'],
            nextCursor: null,
            ledgerEntryIds: [],
            ledgerActivities: [],
            renderedLedgerActivities: [],
        });
    });
});
