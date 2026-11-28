import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';

import {
    clearLocalUserIdentity,
    clearLocalUserRole,
    getLocalUser,
    getTabUserId,
    hasAuthSessionHint,
    LocalStorage,
    pickDisplaySettings,
    resetTabUserId,
    saveLocalUser,
    setAuthSessionHint,
} from './localStorage';

describe('auth session hint storage', () => {
    let values: Map<string, string>;
    let getItem: ReturnType<typeof vi.fn>;
    let removeItem: ReturnType<typeof vi.fn>;
    let setItem: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        values = new Map();
        getItem = vi.fn((key: string) => values.get(key) ?? null);
        removeItem = vi.fn((key: string) => values.delete(key));
        setItem = vi.fn((key: string, value: string) => values.set(key, value));
        vi.stubGlobal('localStorage', {
            clear: vi.fn(() => values.clear()),
            getItem,
            removeItem,
            setItem,
        });
    });

    test('stores only a non-secret boolean session hint', () => {
        expect(setAuthSessionHint(true)).toBe(true);

        expect(hasAuthSessionHint()).toBe(true);
        expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('true');

        expect(setAuthSessionHint(false)).toBe(true);

        expect(hasAuthSessionHint()).toBe(false);
        expect(values.has(LS_KEY_AUTH_SESSION_HINT)).toBe(false);
    });

    test('reports when the session hint cannot be persisted', () => {
        setItem.mockImplementation(() => {
            throw new Error('storage unavailable');
        });

        expect(setAuthSessionHint(true)).toBe(false);
        expect(hasAuthSessionHint()).toBe(false);
    });

    test('falls back to a false marker when removing the session hint fails', () => {
        values.set(LS_KEY_AUTH_SESSION_HINT, 'true');
        removeItem.mockImplementation(() => {
            throw new Error('remove unavailable');
        });

        expect(setAuthSessionHint(false)).toBe(true);
        expect(hasAuthSessionHint()).toBe(false);
        expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('false');
    });

    test('reports when the session hint cannot be cleared or overwritten', () => {
        values.set(LS_KEY_AUTH_SESSION_HINT, 'true');
        removeItem.mockImplementation(() => {
            throw new Error('remove unavailable');
        });
        setItem.mockImplementation(() => {
            throw new Error('write unavailable');
        });

        expect(setAuthSessionHint(false)).toBe(false);
        expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('true');
    });

    test('keeps fallback cleanup failures inside the storage guard', () => {
        getItem.mockImplementation(() => {
            throw new Error('read unavailable');
        });
        removeItem.mockImplementation(() => {
            throw new Error('remove unavailable');
        });

        expect(getLocalUser()).toBeNull();
    });
});

describe('clearLocalUserRole', () => {
    const settings = {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'ru',
        theme: 'dark',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    } satisfies UserSettings;

    beforeEach(() => {
        vi.unstubAllGlobals();
        LocalStorage.remove(LS_KEY_USER);
    });

    test('removes only the cached role and keeps settings', () => {
        saveLocalUser({ role: 'ADMIN', settings });

        clearLocalUserRole();

        expect(getLocalUser()).toEqual({ settings });
    });

    test('keeps the user id (session expiry keeps the per-user cache)', () => {
        saveLocalUser({ id: 'user-1', role: 'USER', settings });

        clearLocalUserRole();

        expect(getLocalUser()).toEqual({ id: 'user-1', settings });
    });

    test('does nothing when no user is cached', () => {
        clearLocalUserRole();

        expect(getLocalUser()).toBeNull();
    });
});

describe('clearLocalUserIdentity (sign-out, invariant 12)', () => {
    // Every setting differs from its reader default, so a value that survives is visible.
    const settings = {
        defaultCurrency: 'EUR',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'ru',
        theme: 'dark',
        simplifyDebts: false,
        skipCategory: true,
        soloModeByDefault: true,
        saveGroupExpensesToSolo: true,
        sex: 'female',
    } satisfies UserSettings;

    beforeEach(() => {
        vi.unstubAllGlobals();
        LocalStorage.remove(LS_KEY_USER);
        resetTabUserId();
    });

    test('leaves only the language and theme in storage', () => {
        saveLocalUser({ id: 'user-1', role: 'ADMIN', settings });

        clearLocalUserIdentity();

        expect(JSON.parse(window.localStorage.getItem(LS_KEY_USER) ?? 'null')).toEqual({
            settings: { language: 'ru', theme: 'dark' },
        });
        expect(getTabUserId()).toBeUndefined();
    });

    test('a signed-out reader gets the defaults for the other settings', () => {
        saveLocalUser({ id: 'user-1', role: 'USER', settings });

        clearLocalUserIdentity();

        expect(getLocalUser()).toEqual({
            settings: {
                defaultCurrency: 'USD',
                defaultCategory: 'other',
                timeFormat: '12h',
                language: 'ru',
                theme: 'dark',
                simplifyDebts: true,
                skipCategory: false,
                soloModeByDefault: false,
                saveGroupExpensesToSolo: false,
                sex: 'male',
            },
        });
    });

    test('does nothing to storage when no user is cached', () => {
        clearLocalUserIdentity();

        expect(window.localStorage.getItem(LS_KEY_USER)).toBeNull();
    });

    test('pickDisplaySettings keeps only the language and theme', () => {
        expect(pickDisplaySettings(settings)).toEqual({ language: 'ru', theme: 'dark' });
    });
});

describe('getLocalUser (LocalUserSchema)', () => {
    const settings = {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'light',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'female',
    } satisfies UserSettings;

    beforeEach(() => {
        vi.unstubAllGlobals();
        LocalStorage.remove(LS_KEY_USER);
    });

    test('reads the id written with the user', () => {
        saveLocalUser({ id: 'user-7', role: 'ADMIN', settings });

        expect(getLocalUser()).toEqual({ id: 'user-7', role: 'ADMIN', settings });
    });

    test('a user stored before 03-7a (no id) is still valid', () => {
        saveLocalUser({ role: 'USER', settings });

        expect(getLocalUser()).toEqual({ role: 'USER', settings });
    });

    test.each([
        ['not an object', 'user'],
        ['null', null],
        ['missing settings', { id: 'user-7' }],
        ['settings not an object', { id: 'user-7', settings: 'dark' }],
    ])('a structurally broken stored user (%s) reads as absent', (_name, stored) => {
        window.localStorage.setItem(LS_KEY_USER, JSON.stringify(stored));

        expect(getLocalUser()).toBeNull();
    });

    test('an older stored user missing settings fields keeps its theme and language', () => {
        window.localStorage.setItem(
            LS_KEY_USER,
            JSON.stringify({ role: 'USER', settings: { language: 'ru', theme: 'dark' } }),
        );

        expect(getLocalUser()).toEqual({
            role: 'USER',
            settings: {
                defaultCurrency: 'USD',
                defaultCategory: 'other',
                timeFormat: '12h',
                language: 'ru',
                theme: 'dark',
                simplifyDebts: true,
                skipCategory: false,
                soloModeByDefault: false,
                saveGroupExpensesToSolo: false,
                sex: 'male',
            },
        });
    });

    test('an invalid field falls back alone; an invalid id or role is dropped', () => {
        window.localStorage.setItem(
            LS_KEY_USER,
            JSON.stringify({ id: 7, role: 'ROOT', settings: { ...settings, theme: 'neon' } }),
        );

        expect(getLocalUser()).toEqual({ settings: { ...settings, theme: 'system' } });
    });
});
