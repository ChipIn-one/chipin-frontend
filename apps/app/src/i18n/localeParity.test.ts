// Spec 04 §2.10, audit 02 §5: every supported locale has the same namespaces and the same keys as
// the default one. Plural forms differ by language (`en` `_one/_other`, `ru` `_one/_few/_many/_other`),
// so a key is compared without its i18next plural suffix.
import { describe, expect, test } from 'vitest';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from 'constants/locales';

type Json = Record<string, unknown>;

// Keys `./locales/<lng>/<ns>.json` and `<...>/common/<lng>.json`.
const APP_FILES = import.meta.glob<Json>('./locales/*/*.json', { eager: true, import: 'default' });
const COMMON_FILES = import.meta.glob<Json>('../../../../packages/i18n-content/common/*.json', {
    eager: true,
    import: 'default',
});

const PLURAL_SUFFIX = /_(?:zero|one|two|few|many|other)$/;

const isObject = (value: unknown): value is Json =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Dotted paths of every leaf, plural suffixes folded into one key. */
const flattenKeys = (value: Json, prefix = ''): string[] =>
    Object.entries(value).flatMap(([key, child]) => {
        const path = prefix + key;

        return isObject(child) ? flattenKeys(child, `${path}.`) : [path.replace(PLURAL_SUFFIX, '')];
    });

/** Namespace → its flattened key set, for one locale. */
const namespacesOf = (lng: string): Map<string, string[]> => {
    const namespaces = new Map<string, string[]>();

    for (const [file, content] of Object.entries(APP_FILES)) {
        const [, fileLng, ns] = /^\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(file) ?? [];

        if (fileLng === lng && ns) {
            namespaces.set(ns, [...new Set(flattenKeys(content))].sort());
        }
    }
    const common = Object.entries(COMMON_FILES).find(([file]) => file.endsWith(`/${lng}.json`));

    if (common) {
        namespaces.set('common', [...new Set(flattenKeys(common[1]))].sort());
    }
    return namespaces;
};

const reference = namespacesOf(DEFAULT_LOCALE);
const OTHER_LOCALES = SUPPORTED_LOCALES.filter(lng => lng !== DEFAULT_LOCALE);

test('the default locale has common and the app namespaces', () => {
    expect(reference.has('common')).toBe(true);
    expect(reference.size).toBeGreaterThan(1);
});

test('no locale folder exists beyond the supported locales', () => {
    const folders = new Set(Object.keys(APP_FILES).map(file => file.split('/')[2]));

    expect([...folders].sort()).toEqual([...SUPPORTED_LOCALES].sort());
});

describe.each(OTHER_LOCALES)('%s', lng => {
    const namespaces = namespacesOf(lng);

    test('has the same namespaces as the default locale', () => {
        expect([...namespaces.keys()].sort()).toEqual([...reference.keys()].sort());
    });

    test.each([...reference.keys()])('%s has the same keys as the default locale', ns => {
        expect(namespaces.get(ns)).toEqual(reference.get(ns));
    });
});
