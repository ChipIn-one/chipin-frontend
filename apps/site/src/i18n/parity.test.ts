import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locales';

// Site key parity (spec 04 §3.2, A-32): every locale has the files and keys of `en`.
const LOCALES_DIR = new URL('./locales/', import.meta.url);

const jsonFiles = (locale: string): string[] =>
    readdirSync(new URL(`${locale}/`, LOCALES_DIR))
        .filter(name => name.endsWith('.json'))
        .sort();

const readJson = (locale: string, file: string): unknown =>
    JSON.parse(readFileSync(new URL(`${locale}/${file}`, LOCALES_DIR), 'utf8'));

/** `a.b.c` for every leaf; a leaf that is not a non-empty string is reported as `a.b.c!`. */
const leafKeys = (value: unknown, prefix = ''): string[] => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return Object.entries(value).flatMap(([key, child]) =>
            leafKeys(child, prefix ? `${prefix}.${key}` : key),
        );
    }
    return [typeof value === 'string' && value.trim() !== '' ? prefix : `${prefix}!`];
};

describe('site locale parity', () => {
    test('the locale folders are exactly the supported locales', () => {
        const folders = readdirSync(LOCALES_DIR, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();

        expect(folders).toEqual([...SUPPORTED_LOCALES].sort());
    });

    const reference = jsonFiles(DEFAULT_LOCALE);

    test.each(SUPPORTED_LOCALES)('%s has the JSON files of the default locale', locale => {
        expect(reference.length).toBeGreaterThan(0);
        expect(jsonFiles(locale)).toEqual(reference);
    });

    test.each(SUPPORTED_LOCALES.flatMap(locale => reference.map(file => [locale, file])))(
        '%s/%s has the keys of the default locale, all non-empty strings',
        (locale, file) => {
            const expected = leafKeys(readJson(DEFAULT_LOCALE, file)).sort();

            expect(expected.every(key => !key.endsWith('!'))).toBe(true);
            expect(leafKeys(readJson(locale, file)).sort()).toEqual(expected);
        },
    );
});
