import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { LS_KEY_LOCALE } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { i18n } from 'i18n';

import { applyLanguage, setAppLanguage } from './setAppLanguage';

beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
});

afterEach(() => i18n.changeLanguage('en'));

// Spec 04 §2.10: a language is a set of lazy chunks; it is loaded before i18next switches to it.
test.each([
    ['setAppLanguage', setAppLanguage],
    ['applyLanguage', applyLanguage],
])('%s loads the language before it switches to it and sets html lang', (_, switchTo) => {
    const loadLanguages = vi.spyOn(i18n, 'loadLanguages');
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');

    return switchTo('ru').then(() => {
        expect(loadLanguages).toHaveBeenCalledExactlyOnceWith('ru');
        expect(changeLanguage).toHaveBeenCalledExactlyOnceWith('ru');
        expect(loadLanguages.mock.invocationCallOrder[0]).toBeLessThan(
            changeLanguage.mock.invocationCallOrder[0] ?? 0,
        );
        expect(i18n.resolvedLanguage).toBe('ru');
        expect(document.documentElement.lang).toBe('ru');
    });
});

test('setAppLanguage saves the language as the preference', () =>
    setAppLanguage('ru').then(() => {
        expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('ru');
    }));

test('applyLanguage does not save the language', () =>
    applyLanguage('ru').then(() => {
        expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('');
    }));

test('a failed load neither switches nor saves', () => {
    const error = new Error('offline');
    vi.spyOn(i18n, 'loadLanguages').mockRejectedValueOnce(error);
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');

    return expect(setAppLanguage('ru'))
        .rejects.toBe(error)
        .then(() => {
            expect(changeLanguage).not.toHaveBeenCalled();
            expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('');
            expect(i18n.resolvedLanguage).toBe('en');
        });
});
