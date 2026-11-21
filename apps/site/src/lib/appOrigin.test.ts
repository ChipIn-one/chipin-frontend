import { describe, expect, test } from 'vitest';

import { appLoginUrl, PROD_APP_ORIGIN, resolveAppOrigin } from './appOrigin';

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

// Spec 04 §4.4 (row 04-3b1): the site's sign-in buttons.
describe('appLoginUrl', () => {
    test('"Sign in/Get started" opens the app sign-in in the page language', () => {
        expect(appLoginUrl('https://app.chipin.one', 'ru')).toBe(
            'https://app.chipin.one/login?locale=ru',
        );
        expect(appLoginUrl('https://app-dev.chipin.one', 'en')).toBe(
            'https://app-dev.chipin.one/login?locale=en',
        );
    });

    test('"Open ChipIn" opens the app sign-in without a language', () => {
        expect(appLoginUrl('https://app.chipin.one')).toBe('https://app.chipin.one/login');
    });
});
