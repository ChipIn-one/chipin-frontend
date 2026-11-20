import { describe, expect, test } from 'vitest';

import { astroLocales, localizedPath, NON_DEFAULT_LOCALES } from './locales';

describe('site locales', () => {
    test('Astro locales are the supported locales, the default one first', () => {
        expect(astroLocales()).toEqual(['en', 'ru']);
        expect(NON_DEFAULT_LOCALES).toEqual(['ru']);
    });

    // URLs of spec 04 §3.2: locale homes with a trailing slash, other pages without.
    test.each([
        ['en', '', '/'],
        ['ru', '', '/ru/'],
        ['en', 'privacy', '/privacy'],
        ['ru', 'privacy', '/ru/privacy'],
    ] as const)('localizedPath(%s, %j) is %s', (locale, slug, path) => {
        expect(localizedPath(locale, slug)).toBe(path);
    });
});
