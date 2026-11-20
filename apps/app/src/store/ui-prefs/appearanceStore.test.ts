// Spec 05 §2 (05-3): the appearance store is the single theme mechanism: the html class always
// equals `resolved`, `system` follows the OS scheme while it is the preference, and the cached
// user's theme moves once into LS_KEY_THEME.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_THEME, LS_KEY_USER } from 'constants/localstorage';
import { clearLocalUserIdentity, LocalStorage, saveLocalUser } from 'helpers/localStorage';

import {
    type AppearancePreference,
    resetAppearanceStore,
    useAppearanceStore,
} from './appearanceStore';

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'dark',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

interface FakeSystemScheme {
    setDark: (isDark: boolean) => void;
    listenerCount: () => number;
}

/** A `matchMedia` whose dark-scheme query can change, with its `change` listeners counted. */
const installMatchMedia = (isDark: boolean): FakeSystemScheme => {
    const listeners = new Set<() => void>();
    const query = {
        matches: isDark,
        addEventListener: (_type: 'change', listener: () => void) => {
            listeners.add(listener);
        },
        removeEventListener: (_type: 'change', listener: () => void) => {
            listeners.delete(listener);
        },
    };

    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (media: string) =>
            media === '(prefers-color-scheme: dark)' ? query : { ...query, matches: false },
    });
    return {
        setDark: next => {
            query.matches = next;
            listeners.forEach(listener => {
                listener();
            });
        },
        listenerCount: () => listeners.size,
    };
};

/** Saves any string, also one the typed helper never writes (a broken or foreign value). */
const saveRawTheme = (value: string) => {
    // eslint-disable-next-line no-restricted-globals -- an invalid saved value, which `LocalStorage.setRaw` does not accept
    localStorage.setItem(LS_KEY_THEME, value);
};

const htmlThemes = (): string[] =>
    ['light', 'dark'].filter(theme => document.documentElement.classList.contains(theme));

const expectHtmlMatchesStore = () => {
    const { resolved } = useAppearanceStore.getState();

    expect(htmlThemes()).toEqual([resolved]);
    expect(document.documentElement.style.colorScheme).toBe(resolved);
};

beforeEach(() => {
    document.documentElement.className = '';
    LocalStorage.remove(LS_KEY_THEME);
    LocalStorage.remove(LS_KEY_USER);
});

afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia');
    LocalStorage.remove(LS_KEY_THEME);
    LocalStorage.remove(LS_KEY_USER);
    // Drops a system subscription left by the test.
    resetAppearanceStore();
});

describe('saved preference', () => {
    test.each([
        ['light', 'light'],
        ['dark', 'dark'],
        // As THEME_INIT_SCRIPT reads it: an unknown value is light.
        ['unexpected', 'light'],
        ['"dark"', 'light'],
    ])('the saved value %s resolves to %s and is applied to <html>', (saved, resolved) => {
        saveRawTheme(saved);

        resetAppearanceStore();

        expect(useAppearanceStore.getState().resolved).toBe(resolved);
        expectHtmlMatchesStore();
    });

    test('setPreference saves the raw string, the format saved before 05-3', () => {
        resetAppearanceStore();

        useAppearanceStore.getState().setPreference('dark');

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('dark');
        expect(useAppearanceStore.getState().preference).toBe('dark');
    });

    test('the html class equals resolved after every setPreference', () => {
        const scheme = installMatchMedia(true);
        resetAppearanceStore();
        const sequence: AppearancePreference[] = ['light', 'dark', 'system', 'light', 'system'];

        expectHtmlMatchesStore();
        for (const preference of sequence) {
            useAppearanceStore.getState().setPreference(preference);
            expectHtmlMatchesStore();
        }
        scheme.setDark(false);
        expectHtmlMatchesStore();
        useAppearanceStore.getState().setPreference('dark');
        expectHtmlMatchesStore();
    });

    test('a sign-out keeps the saved theme (invariant 12)', () => {
        saveLocalUser({ id: 'user-1', role: 'USER', settings });
        resetAppearanceStore();
        useAppearanceStore.getState().setPreference('light');

        clearLocalUserIdentity();
        resetAppearanceStore();

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('light');
        expect(useAppearanceStore.getState().preference).toBe('light');
    });
});

describe('system preference', () => {
    test('without matchMedia (jsdom) system resolves to light', () => {
        LocalStorage.setRaw(LS_KEY_THEME, 'system');

        resetAppearanceStore();

        expect(useAppearanceStore.getState()).toMatchObject({
            preference: 'system',
            resolved: 'light',
        });
        expectHtmlMatchesStore();
    });

    test('follows the system scheme while the preference is system', () => {
        const scheme = installMatchMedia(true);
        LocalStorage.setRaw(LS_KEY_THEME, 'system');

        resetAppearanceStore();
        expect(useAppearanceStore.getState().resolved).toBe('dark');
        expectHtmlMatchesStore();

        scheme.setDark(false);
        expect(useAppearanceStore.getState().resolved).toBe('light');
        expectHtmlMatchesStore();

        scheme.setDark(true);
        expect(useAppearanceStore.getState().resolved).toBe('dark');
        expectHtmlMatchesStore();
    });

    test('unsubscribes when the preference leaves system, and subscribes once again on return', () => {
        const scheme = installMatchMedia(false);
        LocalStorage.setRaw(LS_KEY_THEME, 'system');
        resetAppearanceStore();
        expect(scheme.listenerCount()).toBe(1);

        useAppearanceStore.getState().setPreference('light');
        expect(scheme.listenerCount()).toBe(0);
        scheme.setDark(true);
        expect(useAppearanceStore.getState().resolved).toBe('light');
        expectHtmlMatchesStore();

        useAppearanceStore.getState().setPreference('system');
        useAppearanceStore.getState().setPreference('system');
        expect(scheme.listenerCount()).toBe(1);
        expect(useAppearanceStore.getState().resolved).toBe('dark');
        expectHtmlMatchesStore();
    });

    test('no saved value and no cached user reads as system and writes nothing', () => {
        installMatchMedia(true);

        resetAppearanceStore();

        expect(useAppearanceStore.getState()).toMatchObject({
            preference: 'system',
            resolved: 'dark',
        });
        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBeNull();
    });
});

describe('key migration (remove after 2 releases)', () => {
    test('without the key, the cached user theme is written to the key once', () => {
        saveLocalUser({ id: 'user-1', role: 'USER', settings: { ...settings, theme: 'dark' } });

        resetAppearanceStore();

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('dark');
        expect(useAppearanceStore.getState()).toMatchObject({
            preference: 'dark',
            resolved: 'dark',
        });
        expectHtmlMatchesStore();
    });

    test('an existing key wins over the cached user theme', () => {
        saveLocalUser({ id: 'user-1', role: 'USER', settings: { ...settings, theme: 'dark' } });
        LocalStorage.setRaw(LS_KEY_THEME, 'light');

        resetAppearanceStore();

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('light');
        expect(useAppearanceStore.getState().preference).toBe('light');
    });
});
