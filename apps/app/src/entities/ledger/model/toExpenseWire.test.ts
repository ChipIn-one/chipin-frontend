import { describe, expect, test } from 'vitest';

import { stringifyWireJson } from 'shared/api/wireJson';
import { currencyCode, fromUnits, MoneyWireError } from 'shared/money';

import {
    canonicalDecimal,
    fromExpensePatchWire,
    toCreateLedgerEntryWire,
    toExpensePatchWire,
} from './toExpenseWire';
import type { ExpenseDraft } from './types';

const usd = (units: bigint) => fromUnits(units, currencyCode('USD'));

const draft: ExpenseDraft = {
    description: 'Dinner',
    amount: usd(3_000n),
    date: 1_717_200_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2', 'user-3'],
    category: null,
    sharingMode: {
        type: 'EXACT',
        customShares: { 'user-1': usd(1_000n), 'user-2': usd(1_000n), 'user-3': usd(1_000n) },
    },
};

describe('canonicalDecimal', () => {
    test.each([
        ['50', '50'],
        ['50.0000', '50'],
        ['050.50', '50.5'],
        ['0.000', '0'],
        ['33.3333333333333333', '33.3333333333333333'],
        ['7.', '7'],
    ])('%j → %j', (text, canonical) => {
        expect(canonicalDecimal(text)).toBe(canonical);
    });

    test.each(['', '.5', '-1', '1e3', 'NaN', ' 1'])('%j is not a plain decimal', text => {
        expect(canonicalDecimal(text)).toBeNull();
    });
});

describe('toCreateLedgerEntryWire', () => {
    test('amounts are written from ledger units, never through a double (0.3, not 0.30000000000000004)', () => {
        expect(stringifyWireJson(toCreateLedgerEntryWire(draft))).toBe(
            '{"type":"EXPENSE","expense":{"description":"Dinner","amount":0.3000,"date":1717200000,' +
                '"payerId":"user-1","participantIds":["user-1","user-2","user-3"],"currency":"USD",' +
                '"category":null,"sharingMode":{"type":"EXACT","customShares":' +
                '{"user-1":0.1000,"user-2":0.1000,"user-3":0.1000}}}}',
        );
    });

    test('an id only when a client entry id is given (spec 03 §2.7)', () => {
        expect(toCreateLedgerEntryWire(draft)).not.toHaveProperty('id');
        expect(toCreateLedgerEntryWire(draft, { clientEntryId: 'entry-9' })).toMatchObject({
            id: 'entry-9',
        });
    });

    test('a percent that is not a plain decimal is never written', () => {
        expect(() =>
            toCreateLedgerEntryWire({
                ...draft,
                sharingMode: { type: 'PERCENTAGE', percentageShares: { 'user-1': '1e2' } },
            }),
        ).toThrow(MoneyWireError);
    });
});

describe('toExpensePatchWire', () => {
    test('writes only the named fields, the split block last; never a date', () => {
        expect(
            JSON.stringify(
                Object.keys(
                    toExpensePatchWire({
                        sharingMode: { type: 'AUTO' },
                        participantIds: ['user-1'],
                        amount: usd(1n),
                        category: null,
                        description: 'Lunch',
                    }),
                ),
            ),
        ).toBe('["description","category","amount","participantIds","sharingMode"]');
        expect(toExpensePatchWire({})).toEqual({});
    });
});

describe('03-16b fromExpensePatchWire (a conflict draft read back)', () => {
    test('round trip: amounts through the wire mappers only, in the patch currency or the fallback', () => {
        const patch = {
            description: 'Mine',
            amount: usd(2_500n),
            sharingMode: {
                type: 'EXACT' as const,
                customShares: { 'user-1': usd(1_250n), 'user-2': usd(1_250n) },
            },
        };
        const wire = toExpensePatchWire(patch);

        expect(fromExpensePatchWire(wire, 'USD')).toEqual(patch);
        expect(fromExpensePatchWire(toExpensePatchWire({ currency: 'EUR' }), 'USD')).toEqual({
            currency: 'EUR',
        });
    });

    test('fields that are not a readable patch: null', () => {
        expect(fromExpensePatchWire({ amount: 12 }, 'USD')).toBeNull();
        expect(fromExpensePatchWire('not fields', 'USD')).toBeNull();
        expect(fromExpensePatchWire({ description: 'x' }, 'not a currency')).toBeNull();
    });
});
