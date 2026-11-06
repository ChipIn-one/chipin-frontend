import { expect, test } from 'vitest';

import {
    canRoleAccessSolo,
    isAdminRole,
    isUserTime24H,
    userCurrency,
    userDefaultCategory,
    userLanguage,
    userSaveGroupExpensesToSolo,
    userSex,
    userSimplifyDebts,
    userSkipCategory,
    userSoloModeByDefault,
    userTheme,
} from './settings';
import type { SelfUserSettings } from './types';

const settings: SelfUserSettings = {
    defaultCurrency: 'EUR',
    timeFormat: '24h',
    language: 'ru',
    theme: 'dark',
    simplifyDebts: false,
    defaultCategory: 'transport',
    skipCategory: true,
    soloModeByDefault: true,
    saveGroupExpensesToSolo: true,
    sex: 'female',
};

test('reads expense and profile preferences from the settings', () => {
    expect(userCurrency(settings)).toBe('EUR');
    expect(isUserTime24H(settings)).toBe(true);
    expect(userLanguage(settings)).toBe('ru');
    expect(userTheme(settings)).toBe('dark');
    expect(userSimplifyDebts(settings)).toBe(false);
    expect(userDefaultCategory(settings)).toBe('transport');
    expect(userSkipCategory(settings)).toBe(true);
    expect(userSoloModeByDefault(settings)).toBe(true);
    expect(userSaveGroupExpensesToSolo(settings)).toBe(true);
    expect(userSex(settings)).toBe('female');
});

test('falls back to the defaults without settings', () => {
    expect(userCurrency(null)).toBe('USD');
    expect(isUserTime24H(null)).toBe(false);
    expect(userLanguage(null)).toBe('en');
    expect(userTheme(null)).toBe('system');
    expect(userSimplifyDebts(null)).toBe(true);
    expect(userDefaultCategory(null)).toBe('other');
    expect(userSkipCategory(null)).toBe(false);
    expect(userSoloModeByDefault(null)).toBe(false);
    expect(userSaveGroupExpensesToSolo(null)).toBe(false);
    expect(userSex(null)).toBe('male');
});

test.each([
    { role: 'USER' as const, admin: false },
    { role: 'ADMIN' as const, admin: true },
    { role: undefined, admin: false },
])('keeps Solo unavailable for the $role role', ({ role, admin }) => {
    expect(isAdminRole(role)).toBe(admin);
    expect(canRoleAccessSolo(role)).toBe(false);
});
