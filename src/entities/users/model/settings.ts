// What the app reads from the user's settings, with the defaults for a user without settings
// (signed out with no cached user). The settings come from the self query or, before it has data,
// from the cached `LocalUser` (`helpers/localStorage`).
import { DEFAULT_EXPENSE_CATEGORY } from 'constants/category';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';

import type { SelfUser, SelfUserSettings } from './types';

type Settings = SelfUserSettings | null;
type Role = SelfUser['role'] | undefined;

export const userCurrency = (settings: Settings): string =>
    settings?.defaultCurrency || DEFAULT_CURRENCY_CODE;
export const isUserTime24H = (settings: Settings): boolean => settings?.timeFormat === '24h';
export const userLanguage = (settings: Settings): string => settings?.language ?? 'en';
export const userTheme = (settings: Settings): SelfUserSettings['theme'] =>
    settings?.theme ?? 'system';
export const userSimplifyDebts = (settings: Settings): boolean => settings?.simplifyDebts ?? true;
export const userDefaultCategory = (settings: Settings): string =>
    settings?.defaultCategory ?? DEFAULT_EXPENSE_CATEGORY;
export const userSkipCategory = (settings: Settings): boolean => settings?.skipCategory ?? false;
export const userSoloModeByDefault = (settings: Settings): boolean =>
    settings?.soloModeByDefault ?? false;
export const userSaveGroupExpensesToSolo = (settings: Settings): boolean =>
    settings?.saveGroupExpensesToSolo ?? false;
export const userSex = (settings: Settings): SelfUserSettings['sex'] => settings?.sex ?? 'male';

export const isAdminRole = (role: Role): boolean => role === 'ADMIN';

const IS_SOLO_MODE_RELEASED = false;

export const canRoleAccessSolo = (role: Role): boolean =>
    IS_SOLO_MODE_RELEASED && isAdminRole(role);
