// #708: `<html lang>` follows the active i18next language, on start (a reload with a saved
// language) and on every change.
import i18next, { type i18n as I18n } from 'i18next';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { syncHtmlLang } from './htmlLang';

const instanceIn = (lng: string): Promise<I18n> => {
    const instance = i18next.createInstance();

    return instance
        .init({
            lng,
            fallbackLng: 'en',
            supportedLngs: ['en', 'ru'],
            resources: { en: { common: { page: 'Page' } }, ru: { common: { page: 'Page (ru)' } } },
        })
        .then(() => instance);
};

let stop: () => void = () => undefined;

beforeEach(() => {
    // What `index.html` ships with.
    document.documentElement.lang = 'en';
});

afterEach(() => {
    stop();
    document.documentElement.lang = 'en';
});

test('on start the html lang is the language i18next started in', () =>
    instanceIn('ru').then(instance => {
        stop = syncHtmlLang(instance);

        expect(document.documentElement.lang).toBe('ru');
    }));

test('the html lang follows every language change', () =>
    instanceIn('en').then(instance => {
        stop = syncHtmlLang(instance);

        return instance
            .changeLanguage('ru')
            .then(() => {
                expect(document.documentElement.lang).toBe('ru');
                return instance.changeLanguage('en');
            })
            .then(() => {
                expect(document.documentElement.lang).toBe('en');
            });
    }));

test('a language i18next does not resolve (cimode) leaves the html lang as it is', () =>
    instanceIn('en').then(instance => {
        stop = syncHtmlLang(instance);

        return instance.changeLanguage('cimode').then(() => {
            expect(document.documentElement.lang).toBe('en');
        });
    }));
