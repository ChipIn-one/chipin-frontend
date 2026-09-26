import { expect, test } from 'vitest';

import { resolveBrowserLocale } from './locale';

test('resolves the first supported browser locale without reading stored settings', () => {
    expect(resolveBrowserLocale(['de-DE', 'pt-PT', 'en-US'])).toBe('pt-PT');
});

test('falls back to English when browser locales are unsupported', () => {
    expect(resolveBrowserLocale(['de-DE', 'ja-JP'])).toBe('en');
});
