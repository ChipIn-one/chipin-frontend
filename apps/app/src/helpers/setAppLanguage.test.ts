import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { LS_KEY_LOCALE } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { i18n, I18N_NAMESPACES } from 'i18n';

import { applyLanguage, getPendingLanguage, setAppLanguage } from './setAppLanguage';

type ReadCallback = (error: unknown, data?: unknown) => void;
type Read = (lng: string, ns: string, callback: ReadCallback) => void;
type Connector = { backend: { read: Read }; state: Record<string, number> };

// The real i18next backend connector of the app instance: its `read` is swapped to make the lazy
// chunk reads fail or wait, as on a first visit offline or a 404 after a deploy.
const connector = (): Connector => {
    const value: unknown = i18n.services.backendConnector;

    return value as Connector;
};
const realRead = connector().backend.read;
const ruBundles = new Map<string, unknown>();

const failingRead: Read = (_lng, _ns, callback) => {
    callback(new TypeError('Failed to fetch dynamically imported module'));
};

/** Drops `ru` as if its chunks had failed at init: no bundle, i18next state "failed". */
const dropRussian = () => {
    for (const ns of I18N_NAMESPACES) {
        i18n.removeResourceBundle('ru', ns);
        connector().state[`ru|${ns}`] = -1;
    }
};

beforeEach(() => {
    window.localStorage.clear();
    for (const ns of I18N_NAMESPACES) {
        ruBundles.set(ns, i18n.getResourceBundle('ru', ns));
    }
});

afterEach(() => {
    connector().backend.read = realRead;
    for (const [ns, bundle] of ruBundles) {
        i18n.addResourceBundle('ru', ns, bundle, true, true);
        connector().state[`ru|${ns}`] = 2;
    }
    return i18n.changeLanguage('en');
});

// Spec 04 §2.10: a language is a set of lazy chunks; it is loaded before i18next switches to it.
test.each([
    ['setAppLanguage', setAppLanguage],
    ['applyLanguage', applyLanguage],
])('%s loads a language that is not loaded yet, then switches to it', (_, switchTo) => {
    dropRussian();
    const reloadResources = vi.spyOn(i18n, 'reloadResources');
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');

    return switchTo('ru').then(() => {
        expect(reloadResources).toHaveBeenCalledOnce();
        expect(changeLanguage).toHaveBeenCalledExactlyOnceWith('ru');
        expect(reloadResources.mock.invocationCallOrder[0]).toBeLessThan(
            changeLanguage.mock.invocationCallOrder[0] ?? 0,
        );
        expect(i18n.resolvedLanguage).toBe('ru');
        expect(i18n.t('settings:title')).toBe('Настройки');
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

// R1 M1: i18next itself resolves a failed load and would switch to a language without strings.
test('a failed load rejects without switching, saving or writing html lang', () => {
    dropRussian();
    connector().backend.read = failingRead;
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');
    document.documentElement.lang = 'en';

    return expect(setAppLanguage('ru'))
        .rejects.toThrow('Locale ru not loaded')
        .then(() => {
            expect(changeLanguage).not.toHaveBeenCalled();
            expect(i18n.language).toBe('en');
            expect(i18n.resolvedLanguage).toBe('en');
            expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('');
            expect(document.documentElement.lang).toBe('en');
            expect(getPendingLanguage()).toBeNull();
        });
});

test('the next switch after a failed load reads the language again', () => {
    dropRussian();
    connector().backend.read = failingRead;

    return expect(applyLanguage('ru'))
        .rejects.toThrow()
        .then(() => {
            connector().backend.read = realRead;
            return applyLanguage('ru');
        })
        .then(() => {
            expect(i18n.resolvedLanguage).toBe('ru');
        });
});

// R1 L1: an older switch that finishes after a newer one does not apply.
test('the latest switch wins over an older one still loading', () => {
    dropRussian();
    const waiting: (() => void)[] = [];
    connector().backend.read = (lng, ns, callback) => {
        waiting.push(() => {
            realRead(lng, ns, callback);
        });
    };
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');

    const older = applyLanguage('ru');
    expect(getPendingLanguage()).toBe('ru');

    return setAppLanguage('en')
        .then(() => {
            waiting.forEach(read => {
                read();
            });
            return older;
        })
        .then(() => {
            expect(changeLanguage.mock.calls.map(([lng]) => lng)).toEqual(['en']);
            expect(i18n.resolvedLanguage).toBe('en');
            expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('en');
            expect(getPendingLanguage()).toBeNull();
        });
});

// R2-L1: latest wins by call, not by language: ru (#1), en (#2), ru (#3) ends in ru and saves ru.
test('the latest call wins even when an older call has the same language', () => {
    dropRussian();
    const waiting: (() => void)[] = [];
    connector().backend.read = (lng, ns, callback) => {
        waiting.push(() => {
            realRead(lng, ns, callback);
        });
    };
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');

    const first = applyLanguage('ru');
    const second = setAppLanguage('en');
    const third = setAppLanguage('ru');

    return second
        .then(() => {
            waiting.forEach(read => {
                read();
            });
            return Promise.all([first, third]);
        })
        .then(() => {
            expect(changeLanguage.mock.calls.map(([lng]) => lng)).toEqual(['ru']);
            expect(i18n.resolvedLanguage).toBe('ru');
            expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('ru');
            expect(getPendingLanguage()).toBeNull();
        });
});
