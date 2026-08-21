import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import {
    createExpense,
    createSettlement,
    removeLedgerEntry,
} from './ledgerApi';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        delete: vi.fn(),
        post: vi.fn(),
    },
}));

describe('ledgerApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('creates an expense ledger entry', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: { id: 'entry-1' } });

        return createExpense({
            groupId: 'group-1',
            description: 'Dinner',
            amount: 30,
            date: 1_785_328_628,
            payerId: 'user-1',
            participantIds: ['user-1', 'user-2'],
            currency: 'USD',
        }).then(result => {
            expect(apiInstance.post).toHaveBeenCalledWith('/ledger/entries', {
                type: 'EXPENSE',
                groupId: 'group-1',
                expense: {
                    description: 'Dinner',
                    amount: 30,
                    date: 1_785_328_628,
                    payerId: 'user-1',
                    participantIds: ['user-1', 'user-2'],
                    currency: 'USD',
                    category: null,
                    sharingMode: { type: 'AUTO' },
                },
            });
            expect(result).toEqual({ id: 'entry-1' });
        });
    });

    test('creates a settlement ledger entry', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: { id: 'entry-2' } });

        return createSettlement({
            fromUserId: 'user-1',
            toUserId: 'user-2',
            amount: 20,
            currency: 'EUR',
        }).then(result => {
            expect(apiInstance.post).toHaveBeenCalledWith('/ledger/entries', {
                type: 'SETTLEMENT',
                settlement: {
                    fromUserId: 'user-1',
                    toUserId: 'user-2',
                    amount: 20,
                    currency: 'EUR',
                },
            });
            expect(result).toEqual({ id: 'entry-2' });
        });
    });

    test('removes the requested ledger entry', () => {
        vi.mocked(apiInstance.delete).mockResolvedValue({ data: undefined });

        return removeLedgerEntry({ entryId: 'entry-1' }).then(result => {
            expect(apiInstance.delete).toHaveBeenCalledWith('/ledger/entries/entry-1');
            expect(result).toBeUndefined();
        });
    });

});
