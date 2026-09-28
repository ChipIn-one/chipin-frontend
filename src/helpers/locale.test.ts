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


test('uses the explicit locale preference when cached user language is invalid', () => {
    LocalStorage.set(LS_KEY_USER, {
        role: 'USER',
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'legacy-locale',
            theme: 'system',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: true,
            sex: 'male',
        },
    });
    saveLocalePreference('ru');

    expect(resolveLocale()).toBe('ru');
});
