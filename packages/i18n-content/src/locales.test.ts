import { describe, expect, test } from 'vitest';

import { DEFAULT_LOCALE, LOCALE_PATH, SUPPORTED_LOCALES } from './locales';

const COMMON_FILES = Object.keys(import.meta.glob('../common/*.json'));

describe('locales', () => {
    test('LOCALE_PATH has exactly the supported locales, the default one without a path', () => {
        expect(Object.keys(LOCALE_PATH).sort()).toEqual([...SUPPORTED_LOCALES].sort());
        expect(LOCALE_PATH[DEFAULT_LOCALE]).toBe('');
    });

    test('every supported locale has a common JSON and no other JSON exists', () => {
        expect(COMMON_FILES.sort()).toEqual(
            SUPPORTED_LOCALES.map(locale => `../common/${locale}.json`).sort(),
        );
    });
});
