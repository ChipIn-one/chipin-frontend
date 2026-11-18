import { LOCALE_PATH } from '@chipin/i18n-content';
import { expect, test } from 'vitest';

import { SUPPORTED_LOCALES } from 'constants/locales';

import { LOCALE_PREFIX } from './publicRouteManifest';

// The site builds its locale URLs from LOCALE_PATH (spec 04 §3.2); the app's public manifest must
// serve the same paths.
test('LOCALE_PREFIX of the public manifest matches LOCALE_PATH of @chipin/i18n-content', () => {
    expect(Object.keys(LOCALE_PREFIX).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
        const path = LOCALE_PATH[locale];

        expect(LOCALE_PREFIX[locale]).toBe(path ? `/${path}` : '');
    }
});
