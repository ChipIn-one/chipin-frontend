// Spec 05 §2 (05-3): the appearance store is the single theme mechanism: the html class always
// equals `resolved`, `system` follows the OS scheme while it is the preference, and the cached
// user's theme moves once into LS_KEY_THEME.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_THEME, LS_KEY_USER } from 'constants/localstorage';
import { clearLocalUserIdentity, LocalStorage, saveLocalUser } from 'helpers/localStorage';

import {
    type AppearancePreference,
    initAppearance,
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
    localStorage.setItem(LS_KEY_THEME, value);
};

/** The SPA start: the store as at import, then `initAppearance()` (main.tsx). */
const startAppearance = () => {
    resetAppearanceStore();
    initAppearance();
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

        startAppearance();

        expect(useAppearanceStore.getState().resolved).toBe(resolved);
        expectHtmlMatchesStore();
    });

    test('setPreference saves the raw string, the format saved before 05-3', () => {
        startAppearance();

        useAppearanceStore.getState().setPreference('dark');

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('dark');
        expect(useAppearanceStore.getState().preference).toBe('dark');
    });

    test('the html class equals resolved after every setPreference', () => {
        const scheme = installMatchMedia(true);
        startAppearance();
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
        startAppearance();
        useAppearanceStore.getState().setPreference('light');

        clearLocalUserIdentity();
        startAppearance();

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('light');
        expect(useAppearanceStore.getState().preference).toBe('light');
    });
});

describe('system preference', () => {
    test('without matchMedia (jsdom) system resolves to light', () => {
        LocalStorage.setRaw(LS_KEY_THEME, 'system');

        startAppearance();

        expect(useAppearanceStore.getState()).toMatchObject({
            preference: 'system',
            resolved: 'light',
        });
        expectHtmlMatchesStore();
    });

    test('follows the system scheme while the preference is system', () => {
        const scheme = installMatchMedia(true);
        LocalStorage.setRaw(LS_KEY_THEME, 'system');

        startAppearance();
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
        startAppearance();
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

        startAppearance();

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

        startAppearance();

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

        startAppearance();

        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('light');
        expect(useAppearanceStore.getState().preference).toBe('light');
    });
});

describe('initAppearance', () => {
    test('the store does not touch <html> until initAppearance runs, then applies once', () => {
        installMatchMedia(true);
        LocalStorage.setRaw(LS_KEY_THEME, 'dark');

        resetAppearanceStore();

        expect(useAppearanceStore.getState().resolved).toBe('dark');
        expect(document.documentElement.className).toBe('');

        initAppearance();
        initAppearance();
        expectHtmlMatchesStore();
    });

    test('the migration writes the key only in initAppearance', () => {
        saveLocalUser({ id: 'user-1', role: 'USER', settings: { ...settings, theme: 'dark' } });

        resetAppearanceStore();
        expect(useAppearanceStore.getState().preference).toBe('dark');
        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBeNull();

        initAppearance();
        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('dark');
    });

    test('an unreadable storage reads as light, as THEME_INIT_SCRIPT does', () => {
        installMatchMedia(true);
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get: () => {
                throw new DOMException('blocked', 'SecurityError');
            },
        });
        try {
            startAppearance();
            expect(useAppearanceStore.getState()).toMatchObject({
                preference: 'light',
                resolved: 'light',
            });
            expectHtmlMatchesStore();
        } finally {
            if (descriptor) {
                Object.defineProperty(globalThis, 'localStorage', descriptor);
            }
        }
    });
});

describe('another tab', () => {
    const storageEvent = (key: string | null, newValue: string | null) =>
        new StorageEvent('storage', { key, newValue });

    test('follows a theme saved in another tab without writing it back', () => {
        installMatchMedia(true);
        LocalStorage.setRaw(LS_KEY_THEME, 'light');
        startAppearance();

        window.dispatchEvent(storageEvent(LS_KEY_THEME, 'dark'));
        expect(useAppearanceStore.getState()).toMatchObject({
            preference: 'dark',
            resolved: 'dark',
        });
        expectHtmlMatchesStore();
        // This tab's storage is not written by the event (the other tab wrote the shared one).
        expect(LocalStorage.getRaw(LS_KEY_THEME)).toBe('light');

        window.dispatchEvent(storageEvent(LS_KEY_THEME, 'unexpected'));
        expect(useAppearanceStore.getState().preference).toBe('light');
        expectHtmlMatchesStore();

        window.dispatchEvent(storageEvent(LS_KEY_THEME, null));
        expect(useAppearanceStore.getState()).toMatchObject({
            preference: 'system',
            resolved: 'dark',
        });
        expectHtmlMatchesStore();
    });

    test('ignores other keys, and is not listened to before initAppearance', () => {
        LocalStorage.setRaw(LS_KEY_THEME, 'light');
        resetAppearanceStore();

        window.dispatchEvent(storageEvent(LS_KEY_THEME, 'dark'));
        expect(useAppearanceStore.getState().preference).toBe('light');

        initAppearance();
        window.dispatchEvent(storageEvent(LS_KEY_USER, 'dark'));
        expect(useAppearanceStore.getState().preference).toBe('light');
    });
});
