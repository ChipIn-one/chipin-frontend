import { describe, expect, test } from 'vitest';

import { resolveInputCurrency } from './expenseModalCurrency';

describe('EXP-072 resolveInputCurrency', () => {
    test('EXP-072 the context last selected currency wins over the global one and the default', () => {
        expect(
            resolveInputCurrency({
                contextLastSelectedCurrency: 'VND',
                globalLastSelectedCurrency: 'EUR',
                defaultCurrency: 'USD',
                fallbackCurrency: 'USD',
            }),
        ).toEqual({ currency: 'VND', source: 'context' });
    });

    test('EXP-072 the global last selected currency is used when the context has none', () => {
        expect(
            resolveInputCurrency({
                contextLastSelectedCurrency: null,
                globalLastSelectedCurrency: 'EUR',
                defaultCurrency: 'GBP',
                fallbackCurrency: 'USD',
            }),
        ).toEqual({ currency: 'EUR', source: 'global' });
    });

    test('EXP-072 the default currency is used without a last selected currency', () => {
        expect(
            resolveInputCurrency({
                contextLastSelectedCurrency: null,
                globalLastSelectedCurrency: null,
                defaultCurrency: 'GBP',
                fallbackCurrency: 'USD',
            }),
        ).toEqual({ currency: 'GBP', source: 'default' });
    });

    test('EXP-072 the app fallback is used when every other source is absent', () => {
        expect(resolveInputCurrency({ fallbackCurrency: 'USD' })).toEqual({
            currency: 'USD',
            source: 'fallback',
        });
    });

    test('EXP-072 null, missing and empty values (older backend data) fall through', () => {
        expect(
            resolveInputCurrency({
                contextLastSelectedCurrency: '',
                globalLastSelectedCurrency: undefined,
                defaultCurrency: 'KHR',
                fallbackCurrency: 'USD',
            }),
        ).toEqual({ currency: 'KHR', source: 'default' });
        expect(
            resolveInputCurrency({
                contextLastSelectedCurrency: undefined,
                globalLastSelectedCurrency: null,
                defaultCurrency: '',
                fallbackCurrency: 'USD',
            }),
        ).toEqual({ currency: 'USD', source: 'fallback' });
    });
});
