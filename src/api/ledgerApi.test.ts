import { beforeEach, describe, expect, test, vi } from 'vitest';

import { InvalidPathSegmentError } from './apiPath';
import { apiInstance } from './chipin.instance';
import { fetchLedgerEntry, removeLedgerEntry } from './ledgerApi';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        delete: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
    },
}));

describe('ledgerApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('removes the requested ledger entry', () => {
        vi.mocked(apiInstance.delete).mockResolvedValue({ data: undefined });

        return removeLedgerEntry({ entryId: 'entry-1' }).then(result => {
            expect(apiInstance.delete).toHaveBeenCalledWith('/ledger/entries/entry-1');
            expect(result).toBeUndefined();
        });
    });

    test('fetches a canonical ledger entry by id', () => {
        vi.mocked(apiInstance.get).mockResolvedValue({ data: { id: 'entry-1' } });

        return fetchLedgerEntry({ entryId: 'entry-1' }).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/ledger/entries/entry-1');
            expect(result).toEqual({ id: 'entry-1' });
        });
    });
});

describe('ledgerApi path segment guard', () => {
    test.each([
        ['removeLedgerEntry', () => removeLedgerEntry({ entryId: 'a/b' })],
        ['fetchLedgerEntry', () => fetchLedgerEntry({ entryId: 'a/b' })],
    ])('%s rejects a "/" in a path parameter without calling the API', (_name, onCall) => {
        return expect(onCall())
            .rejects.toBeInstanceOf(InvalidPathSegmentError)
            .then(() => {
                expect(apiInstance.delete).not.toHaveBeenCalled();
                expect(apiInstance.get).not.toHaveBeenCalled();
            });
    });
});
