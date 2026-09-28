import { beforeEach, expect, test } from 'vitest';

import { LS_KEY_LOCALE, LS_KEY_USER } from 'constants/localstorage';

import { LocalStorage } from './localStorage';
import {
    resolveBrowserLocale,
    resolveLocale,
    saveLocalePreference,
} from './locale';

beforeEach(() => {
    LocalStorage.remove(LS_KEY_LOCALE);
    LocalStorage.remove(LS_KEY_USER);
});

test('resolves the first supported browser locale without reading stored settings', () => {
    expect(resolveBrowserLocale(['de-DE', 'pt-PT', 'en-US'])).toBe('pt-PT');
});

test('falls back to English when browser locales are unsupported', () => {
    expect(resolveBrowserLocale(['de-DE', 'ja-JP'])).toBe('en');
});


test('persists an explicit locale preference for unauthenticated reloads', () => {
    saveLocalePreference('ru');

    expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('ru');
    expect(resolveLocale()).toBe('ru');
});
