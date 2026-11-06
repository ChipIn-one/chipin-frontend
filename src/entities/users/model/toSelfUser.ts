import type { components } from 'shared/api/generated/schema';

import type { SelfUser, SelfUserSettings } from './types';

type SelfUserResponse = components['schemas']['SelfUser'];

const toTheme = (theme: string): SelfUserSettings['theme'] =>
    theme === 'light' || theme === 'dark' ? theme : 'system';

/** `SelfUser` (wire) → `SelfUser` (domain). */
export const toSelfUser = (response: SelfUserResponse): SelfUser => ({
    id: response.id,
    email: response.email,
    displayName: response.displayName,
    picture: response.picture ?? null,
    role: response.role,
    subscriptionUntil: response.subscriptionUntil,
    inviteToken: response.inviteToken,
    settings: {
        defaultCurrency: response.settings.defaultCurrency,
        defaultCategory: response.settings.defaultCategory,
        timeFormat: response.settings.timeFormat,
        language: response.settings.language,
        theme: toTheme(response.settings.theme),
        simplifyDebts: response.settings.simplifyDebts,
        skipCategory: response.settings.skipCategory,
        soloModeByDefault: response.settings.soloModeByDefault,
        saveGroupExpensesToSolo: response.settings.saveGroupExpensesToSolo,
        sex: response.settings.sex,
    },
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
});
