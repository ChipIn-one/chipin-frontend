import { beforeEach, expect, test } from 'vitest';

import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_LOCALE, LS_KEY_USER } from 'constants/localstorage';

import { matchLocale, resolveBrowserLocale, resolveLocale, saveLocalePreference } from './locale';
import { LocalStorage } from './localStorage';

beforeEach(() => {
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    LocalStorage.remove(LS_KEY_LOCALE);
    LocalStorage.remove(LS_KEY_USER);
});

test('resolves the first supported browser locale without reading stored settings', () => {
    expect(resolveBrowserLocale(['de-DE', 'ru-RU', 'en-US'])).toBe('ru');
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

test('prefers an explicit guest locale over a valid signed-out user cache', () => {
    LocalStorage.set(LS_KEY_USER, {
        role: 'USER',
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
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

test('prefers the cached user locale while an auth session is being restored', () => {
    LocalStorage.set(LS_KEY_USER, {
        role: 'USER',
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
            theme: 'system',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: true,
            sex: 'male',
        },
    });
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    saveLocalePreference('ru');

    expect(resolveLocale()).toBe('en');
});

// #609: es, pt-BR and pt-PT were removed; any stored, cached or browser value that
// still carries them resolves to English instead of failing.
test.each(['es', 'es-ES', 'es-419', 'pt', 'pt-BR', 'pt-PT', 'pt_br', 'pt-AO'])(
    'resolves the removed locale %s to English',
    raw => {
        expect(matchLocale(raw)).toBe('en');
    },
);

test('keeps English and Russian matching unchanged', () => {
    expect(matchLocale('en')).toBe('en');
    expect(matchLocale('en-GB')).toBe('en');
    expect(matchLocale('ru')).toBe('ru');
    expect(matchLocale('ru_RU')).toBe('ru');
    expect(matchLocale('de-DE')).toBeNull();
});

test('a removed browser language resolves to English before later candidates', () => {
    expect(resolveBrowserLocale(['pt-BR', 'ru-RU'])).toBe('en');
    expect(resolveBrowserLocale(['es-ES'])).toBe('en');
});

test.each(['es', 'pt-BR', 'pt-PT'])(
    'a signed-in user with the removed saved locale %s gets English',
    language => {
        LocalStorage.set(LS_KEY_USER, {
            role: 'USER',
            settings: {
                defaultCurrency: 'USD',
                defaultCategory: 'food',
                timeFormat: '24h',
                language,
                theme: 'system',
                simplifyDebts: true,
                skipCategory: false,
                soloModeByDefault: false,
                saveGroupExpensesToSolo: true,
                sex: 'male',
            },
        });
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        saveLocalePreference('ru');

        expect(resolveLocale()).toBe('en');
    },
);

test('a removed explicit guest locale preference resolves to English', () => {
    LocalStorage.set(LS_KEY_LOCALE, 'pt-PT');

    expect(resolveLocale()).toBe('en');
});
