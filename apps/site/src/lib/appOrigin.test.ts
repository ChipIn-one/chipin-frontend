import { describe, expect, test } from 'vitest';

import { PROD_APP_ORIGIN, resolveAppOrigin } from './appOrigin';

describe('resolveAppOrigin', () => {
    test('returns a bare https origin', () => {
        expect(resolveAppOrigin({ value: 'https://app-dev.chipin.one', onVercel: true })).toBe(
            'https://app-dev.chipin.one',
        );
    });

    test('falls back to the prod app outside Vercel', () => {
        expect(resolveAppOrigin({ value: undefined, onVercel: false })).toBe(PROD_APP_ORIGIN);
        expect(resolveAppOrigin({ value: '', onVercel: false })).toBe(PROD_APP_ORIGIN);
    });

    test('a Vercel build must set it', () => {
        expect(() => resolveAppOrigin({ value: undefined, onVercel: true })).toThrow(/must be set/);
    });

    test.each([
        'http://app.chipin.one',
        'https://app.chipin.one/',
        'https://app.chipin.one/login',
        'app.chipin.one',
        'javascript:alert(1)',
    ])('rejects %s', value => {
        expect(() => resolveAppOrigin({ value, onVercel: false })).toThrow(/PUBLIC_APP_ORIGIN/);
    });
});
