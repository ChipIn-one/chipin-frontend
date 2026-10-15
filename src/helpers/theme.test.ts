import { beforeEach, expect, test } from 'vitest';

import type { ThemeName } from 'api/chipin.types';
import { LS_KEY_USER } from 'constants/localstorage';
import { getLocalUser, LocalStorage } from 'helpers/localStorage';

import { isPreferredPublicThemeDark } from './theme';

beforeEach(() => {
    LocalStorage.remove(LS_KEY_USER);
});

test('a first-time visitor uses the OS theme without cached account settings', () => {
    expect(isPreferredPublicThemeDark(true)).toBe(true);
    expect(isPreferredPublicThemeDark(false)).toBe(false);
});

test.each([
    ['light', true, false],
    ['dark', false, true],
    ['system', true, true],
    ['system', false, false],
] as const)('cached theme %s and OS dark=%s resolves to %s', (theme, systemDark, expected) => {
    const cachedTheme: ThemeName = theme;
    LocalStorage.set(LS_KEY_USER, {
        role: 'USER',
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'ru',
            theme: cachedTheme,
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        },
    });

    expect(isPreferredPublicThemeDark(systemDark)).toBe(expected);
    expect(getLocalUser()?.settings.theme).toBe(theme);
});

test('unknown cached theme falls back to system theme', () => {
    window.localStorage.setItem(LS_KEY_USER, JSON.stringify({
        role: 'USER', settings: { theme: 'unsupported-theme' },
    }));

    expect(isPreferredPublicThemeDark(true)).toBe(true);
    expect(isPreferredPublicThemeDark(false)).toBe(false);
});
